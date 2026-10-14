// 有氧自动匹配的端到端验收脚本：在真实运行的服务上跑一遍完整链路，结束后清理现场。
//
// 用法（先启动后端）：
//   node tools/verify-aerobic-match.mjs
//   API_BASE=http://localhost:43128/api DB_PATH=server/health_data.db node tools/verify-aerobic-match.mjs
//
// 脚本会创建一个临时计划、插入一条匹配的导入运动记录、读取匹配结果，
// 然后删除这条记录和临时计划，不影响真实数据。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = process.env.API_BASE || 'http://localhost:43128/api';
const DB_PATH = process.env.DB_PATH || path.join(projectRoot, 'server', 'health_data.db');

const TEST_DATE = '2026-10-05';
const PLAN_NAME = '__aerobic-match-verify__';
const MARKER = 'aerobic_match_verify';

async function api(route, options) {
  const response = await fetch(`${API_BASE}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers || {}) }
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function assert(condition, message) {
  if (!condition) throw new Error(`验收失败：${message}`);
  console.log(`  ✓ ${message}`);
}

const exercises = await api('/training-exercises');
const walking = exercises.body.exercises.find(
  (exercise) => exercise.verificationMode === 'auto' && exercise.sportTypes?.includes('walking')
);
assert(walking, `找到配置了 walking 的自动验证项目（${walking?.name}）`);

const created = await api('/training-plans/with-sessions', {
  method: 'POST',
  body: JSON.stringify({
    plan: { name: PLAN_NAME, startDate: '2026-10-01', endDate: '2026-10-10' },
    sessions: [
      {
        scheduledDate: TEST_DATE,
        items: [{ exerciseId: walking.id, targets: { duration: 30, distance: 3 } }]
      }
    ]
  })
});
assert(created.status === 201, `创建临时计划（id=${created.body?.id}）`);
const planId = created.body.id;

try {
  const db = new DatabaseSync(DB_PATH);
  const value = JSON.stringify({ sport_type: 2, category: 'walking', start_time: 1, duration: 1920, distance: 3350 });
  db.prepare(
    `INSERT INTO sport_records (uid, sid, category, "key", time, date, value, parsed_value, update_time)
     VALUES (?, ?, 'walking', 'walking', 1, ?, ?, ?, ?)`
  ).run(MARKER, MARKER, TEST_DATE, value, value, Date.now());
  db.close();

  const detail = await api(`/training-plans/${planId}`);
  const [session] = detail.body.sessions;
  const match = session.items[0].match;

  assert(match?.status === 'achieved', `导入记录达标 → 项目状态 ${match?.status}`);
  assert(match.record.distanceMeters === 3350, `匹配到正确的运动记录（${match.record.distanceMeters} 米）`);
  assert(session.status === 'achieved', `训练单元汇总为 ${session.status}`);
  assert(detail.body.coverage.coverageRate === 1, `数据覆盖率 ${detail.body.coverage.coverageRate}`);
  assert(
    detail.body.coverage.verifiableCompletionRate === 1,
    `可验证完成率 ${detail.body.coverage.verifiableCompletionRate}`
  );

  // 计划列表用另一条批量查询算覆盖率和达成度，单独校验一次，避免两处口径不一致。
  const list = await api('/training-plans');
  const listed = list.body.plans.find((plan) => plan.id === planId);
  assert(listed.coverage.matchedItems === 1, `计划列表也带上覆盖率（matched=${listed.coverage.matchedItems}）`);
  assert(listed.adherence.eligibleDays === 1, `计划列表已过期训练日 ${listed.adherence.eligibleDays}`);
  assert(listed.adherence.fulfilledDays === 1, `计划列表履约日 ${listed.adherence.fulfilledDays}`);
  assert(listed.adherence.tier === 'complete', `计划列表达成度档位 ${listed.adherence.tier}`);

  console.log('验收通过：有氧训练自动匹配链路正常。');
} finally {
  const cleanupDb = new DatabaseSync(DB_PATH);
  cleanupDb.prepare('DELETE FROM sport_records WHERE uid = ?').run(MARKER);
  cleanupDb.close();
  const removed = await api(`/training-plans/${planId}`, { method: 'DELETE' });
  console.log(`清理：临时运动记录已删除，临时计划删除状态 ${removed.status}`);
}
