import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:43128';
const password = process.env.SMOKE_PASSWORD || '';

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(10_000), ...options });
}

// 冒烟测试针对的是一个**正在运行**的服务（本地 `pnpm dev:server`，或单独执行
// `pnpm test:smoke`）。没有服务在监听时应当跳过，而不是失败：否则默认的
// `pnpm test` 在任何没有服务端的环境里（CI 的 quality 任务就是）必然失败，
// 把质量门禁变成永远无法通过的摆设。
//
// 探活超时给到 5 秒：这个判断是模块顶层执行的，而 `pnpm test` 现在会先 import
// 客户端那批测试（其中 planModule 会在 import 期同步跑一次静态检查），机器繁忙时
// 2 秒的探活会被拖超时，于是服务明明在跑却被判成"没有服务监听"而静默跳过——
// 一个会无声退化成 skip 的门禁比没有门禁更危险。宁可多等 3 秒。
async function serverIsReachable() {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
}

const skipReason = (await serverIsReachable()) ? false : `没有服务监听 ${baseUrl}，跳过冒烟测试`;

test('API smoke: health endpoint is available', { skip: skipReason }, async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test(
  'API smoke: protected dashboard flow works with configured password',
  { skip: skipReason || !password },
  async () => {
    const failedLoginResponse = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: `${password}-incorrect` })
    });
    assert.equal(failedLoginResponse.status, 401);

    const loginResponse = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password })
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get('set-cookie');
    assert.ok(cookie, 'login should return a session cookie');
    const cookieHeader = cookie.split(';', 1)[0];

    const statusResponse = await request('/api/auth/status', { headers: { cookie: cookieHeader } });
    assert.equal(statusResponse.status, 200);
    assert.equal((await statusResponse.json()).authenticated, true);

    const datesResponse = await request('/api/dates', { headers: { cookie: cookieHeader } });
    assert.equal(datesResponse.status, 200);
    const dates = (await datesResponse.json()).dates;
    assert.ok(Array.isArray(dates));

    if (dates.length > 0) {
      const summaryResponse = await request(`/api/dates/${dates[0]}/summary`, { headers: { cookie: cookieHeader } });
      assert.equal(summaryResponse.status, 200);
      assert.equal((await summaryResponse.json()).date, dates[0]);
    }

    const sessionLoginResponse = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password, remember: false })
    });
    assert.equal(sessionLoginResponse.status, 200);
    assert.doesNotMatch(sessionLoginResponse.headers.get('set-cookie') || '', /Max-Age=/i);
  }
);
