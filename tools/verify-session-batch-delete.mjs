// 训练单元"复合条件检索 + 批量删除"的端到端验收脚本：在真实运行的服务上跑一遍 HTTP 链路。
//
// 用法（先启动后端）：
//   node tools/verify-session-batch-delete.mjs
//   API_BASE=http://localhost:43128/api node tools/verify-session-batch-delete.mjs
//
// 脚本会创建一个临时计划（12 个"批量加错的"训练单元 + 1 个不该被删的单元），
// 按复合条件检索、按筛选结果批量删除，最后删掉临时计划，不影响真实数据。
const API_BASE = process.env.API_BASE || 'http://localhost:43128/api';

const PLAN_NAME = '__session-batch-delete-verify__';
const MISTAKE_NOTE = 'batch added by mistake';

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

/** 相对今天偏移若干天的日期键；按 UTC 午夜做算术，不涉及时区偏移。 */
function shiftDays(delta) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const exercises = await api('/training-exercises');
// 人工验证的项目才推得出"未完成"：自动项目没有导入记录时是"无数据"，不是未完成。
const exercise = exercises.body.exercises.find((item) => item.enabled && item.verificationMode === 'manual');
assert(exercise, `取到一个启用中的人工验证项目（${exercise?.name}）`);

const mistakeDates = Array.from({ length: 12 }, (_, index) => shiftDays(-(index + 1)));
const survivorDate = shiftDays(-20);
const created = await api('/training-plans/with-sessions', {
  method: 'POST',
  body: JSON.stringify({
    plan: { name: PLAN_NAME, startDate: shiftDays(-30), endDate: shiftDays(5) },
    sessions: [
      ...mistakeDates.map((scheduledDate) => ({
        scheduledDate,
        notes: MISTAKE_NOTE,
        items: [{ exerciseId: exercise.id, targets: { sets: 3 } }]
      })),
      { scheduledDate: survivorDate, items: [{ exerciseId: exercise.id, targets: { sets: 3 } }] }
    ]
  })
});
assert(created.status === 201, `创建临时计划（id=${created.body?.id}）`);
const planId = created.body.id;

const filter = {
  planId,
  startDate: shiftDays(-15),
  endDate: shiftDays(-1),
  status: 'missed',
  // 关键词只搜训练内容（训练项目名），所以这里用项目名而不是备注来圈定这一批。
  search: exercise.name
};

try {
  // 复合条件的四个部分是 AND；分页只是展示手段，total 是筛选后的全部行数。
  const firstPage = await api(
    `/training-sessions?planId=${planId}&startDate=${filter.startDate}&endDate=${filter.endDate}` +
      `&status=missed&search=${encodeURIComponent(exercise.name)}&page=1&pageSize=5`
  );
  assert(firstPage.status === 200, '复合条件检索返回 200');
  assert(firstPage.body.total === 12, `筛选命中 12 个训练单元（实际 ${firstPage.body.total}）`);
  assert(firstPage.body.sessions.length === 5, '首页只返回 5 行，但 total 是筛选后的全部行数');
  assert(firstPage.body.executionCount === 0, '匹配结果里没有已打卡的单元');

  // 去掉日期区间，同计划的 13 个单元（含区间外那一个）都该被项目名搜到。
  const byExercise = await api(
    `/training-sessions?planId=${planId}&search=${encodeURIComponent(exercise.name)}&pageSize=50`
  );
  assert(byExercise.body.total === 13, `按训练项目名检索命中 13 个单元（实际 ${byExercise.body.total}）`);

  // 单元名称和备注是自由文本，不参与这个条件：拿备注去搜这个临时计划应该是 0 条。
  const byNote = await api(`/training-sessions?planId=${planId}&search=${encodeURIComponent(MISTAKE_NOTE)}&pageSize=50`);
  assert(byNote.body.total === 0, `备注不参与训练内容检索（实际 ${byNote.body.total}）`);

  // 空条件的删除等于删掉全部训练单元，必须被挡住。
  const noFilter = await api('/training-sessions', { method: 'DELETE', body: JSON.stringify({ filter: {} }) });
  assert(noFilter.status === 400 && noFilter.body.code === 'SESSION_DELETE_FILTER_REQUIRED', '空筛选条件被拒绝');
  const noScope = await api('/training-sessions', { method: 'DELETE', body: JSON.stringify({ ids: [] }) });
  assert(noScope.status === 400 && noScope.body.code === 'SESSION_DELETE_SCOPE_REQUIRED', '空 ids 被拒绝');
  // 删除不像列表那样静默忽略认不出的条件。
  const badStatus = await api('/training-sessions', {
    method: 'DELETE',
    body: JSON.stringify({ filter: { planId, status: 'planned' } })
  });
  assert(badStatus.status === 400 && badStatus.body.code === 'SESSION_FILTER_INVALID', '认不出的状态被拒绝');
  const badLogged = await api('/training-sessions', {
    method: 'DELETE',
    body: JSON.stringify({ filter: { planId, logged: 'yes' } })
  });
  assert(badLogged.status === 400 && badLogged.body.code === 'SESSION_FILTER_INVALID', '认不出的打卡状态被拒绝');
  const preDeleteLogged = await api(`/training-sessions?planId=${planId}&logged=true&pageSize=50`);
  assert(preDeleteLogged.body.total === 0, '这一批还没打卡，按「已打卡」筛不到');
  assert(
    (await api(`/training-sessions?planId=${planId}&logged=false&pageSize=50`)).body.total === 13,
    '按「未打卡」筛到全部 13 个'
  );

  // 条件删除必须带数量确认：不带就拒绝，对不上就 409，两种情况都不能动数据。
  const withoutCount = await api('/training-sessions', { method: 'DELETE', body: JSON.stringify({ filter }) });
  assert(
    withoutCount.status === 400 && withoutCount.body.code === 'SESSION_DELETE_COUNT_REQUIRED',
    '不带 expectedCount 的条件删除被拒绝'
  );
  const wrongCount = await api('/training-sessions', {
    method: 'DELETE',
    body: JSON.stringify({ filter, expectedCount: 5 })
  });
  assert(
    wrongCount.status === 409 && wrongCount.body.code === 'SESSION_DELETE_COUNT_CHANGED',
    `数量对不上被拒绝（声明 5 条 / 实际 ${wrongCount.body?.details?.matchedCount} 条）`
  );
  const stillThere = await api(`/training-sessions?planId=${planId}&pageSize=50`);
  assert(stillThere.body.total === 13, `被拒绝的删除没有动数据（仍是 ${stillThere.body.total} 个）`);

  // 按筛选结果删除：一次删掉 12 个，跨页也一起删。
  const removed = await api('/training-sessions', {
    method: 'DELETE',
    body: JSON.stringify({ filter, expectedCount: 12 })
  });
  assert(removed.status === 200, '删除筛选结果返回 200');
  assert(removed.body.scope === 'filter', `删除口径 ${removed.body.scope}`);
  assert(removed.body.deletedCount === 12, `删掉 12 个训练单元（实际 ${removed.body.deletedCount}）`);

  // 同一份请求再发一次：命中 0 条，和声明的 12 条对不上，应当被 409 挡住而不是静默成功。
  const repeated = await api('/training-sessions', {
    method: 'DELETE',
    body: JSON.stringify({ filter, expectedCount: 12 })
  });
  assert(
    repeated.status === 409 && repeated.body.details.matchedCount === 0,
    '重复提交被数量确认挡住（匹配 0 条）'
  );

  const afterFilterDelete = await api(`/training-sessions?planId=${planId}&pageSize=50`);
  assert(afterFilterDelete.body.total === 1, `计划里只剩 1 个训练单元（实际 ${afterFilterDelete.body.total}）`);
  assert(
    afterFilterDelete.body.sessions[0].scheduledDate === survivorDate,
    `留下的是不符合筛选条件的那一个（${afterFilterDelete.body.sessions[0].scheduledDate}）`
  );

  // 打卡状态筛选：留下来的那个还没打卡，补一次卡之后它应该翻到"已打卡"这边。
  const survivorId = afterFilterDelete.body.sessions[0].id;
  const notLoggedYet = await api(`/training-sessions?planId=${planId}&logged=true&pageSize=50`);
  assert(notLoggedYet.body.total === 0, '补卡前没有已打卡的单元');
  const stillNotLogged = await api(`/training-sessions?planId=${planId}&logged=false&pageSize=50`);
  assert(stillNotLogged.body.total === 1, '补卡前它属于未打卡');

  const day = await api(`/training-execution?date=${afterFilterDelete.body.sessions[0].scheduledDate}`);
  const entry = day.body.sessions.find((session) => session.sessionId === survivorId);
  assert(entry && entry.items.length > 0, `读到待打卡的训练单元（${entry?.items.length} 个项目）`);
  const backfilled = await api(`/training-sessions/${survivorId}/execution`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'completed',
      items: entry.items.map((item) => ({ sessionItemId: item.sessionItemId, status: 'done', actuals: { sets: 3 } }))
    })
  });
  assert(backfilled.status === 200, `人工补卡成功（${backfilled.status}）`);

  const loggedNow = await api(`/training-sessions?planId=${planId}&logged=true&pageSize=50`);
  assert(loggedNow.body.total === 1, `补卡后已打卡的单元是 1 个（实际 ${loggedNow.body.total}）`);
  assert(loggedNow.body.executionCount === 1, 'executionCount 同步反映打卡条数');
  assert(
    (await api(`/training-sessions?planId=${planId}&logged=false&pageSize=50`)).body.total === 0,
    '同一批单元不会同时算作未打卡'
  );

  // 打卡状态也能参与删除条件，而且是先把条件发给服务端重新求交；数量确认照样要对上。
  const removedLogged = await api('/training-sessions', {
    method: 'DELETE',
    body: JSON.stringify({ filter: { planId, logged: 'true' }, expectedCount: 1 })
  });
  assert(removedLogged.status === 200 && removedLogged.body.deletedCount === 1, '按「已打卡」筛选结果删除 1 个');

  // 按勾选的 id 删除：这是另一条入口。先建一个单元回来，免得只剩空列表看不出区别。
  const extraDate = shiftDays(-25);
  const extra = await api(`/training-plans/${planId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ scheduledDate: extraDate, items: [{ exerciseId: exercise.id, targets: { sets: 3 } }] })
  });
  assert(extra.status === 201, `临时计划里再加一个单元（id=${extra.body?.id}）`);
  const byIds = await api('/training-sessions', {
    method: 'DELETE',
    body: JSON.stringify({ ids: [extra.body.id, 999999] })
  });
  assert(byIds.status === 200 && byIds.body.scope === 'ids', '按 ids 删除返回 200');
  assert(byIds.body.deletedCount === 1, `不存在的 id 静默略过（删除 ${byIds.body.deletedCount} 个）`);

  const finalList = await api(`/training-sessions?planId=${planId}&pageSize=50`);
  assert(finalList.body.total === 0, '临时计划下的训练单元已全部删除');

  console.log('验收通过：复合条件检索与批量删除链路正常。');
} finally {
  const removed = await api(`/training-plans/${planId}`, { method: 'DELETE' });
  console.log(`清理：临时计划删除状态 ${removed.status}`);
}
