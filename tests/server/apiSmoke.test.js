import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const password = process.env.SMOKE_PASSWORD || '';

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

test('API smoke: health endpoint is available', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ok');
});

test('API smoke: protected dashboard flow works with configured password', { skip: !password }, async () => {
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
});
