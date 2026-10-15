// 训练内容（训练单元内的训练项目）批量删除的端到端验收脚本：在真实运行的服务上跑一遍 HTTP 链路。
//
// 用法（先启动后端）：
//   node tools/verify-session-item-delete.mjs
//   API_BASE=http://localhost:43128/api node tools/verify-session-item-delete.mjs
//
// 脚本创建两个临时计划：一个计划里 3 天配了「A+B」、1 天只配了「A」；另一个计划里 1 天只配了「A」。
// 然后验证预览数字、数量确认、按项目批删（跳过只剩一个项目的那天）、以及展开行的按 id 单条删除，
// 最后删掉临时计划，不影响真实数据。
const API_BASE = process.env.API_BASE || 'http://localhost:43128/api';

const PLAN_NAME = '__session-item-delete-verify__';
const OTHER_PLAN_NAME = '__session-item-delete-verify-other__';

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

function shiftDays(delta) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

const exercises = await api('/training-exercises');
const manual = exercises.body.exercises.filter((item) => item.enabled && item.verificationMode === 'manual');
const target = manual[0];
const other = manual[1];
assert(target && other, `取到两个人工验证项目（${target?.name} / ${other?.name}）`);

async function createPlan(name, sessions) {
  const created = await api('/training-plans/with-sessions', {
    method: 'POST',
    body: JSON.stringify({ plan: { name, startDate: shiftDays(-30), endDate: shiftDays(5) }, sessions })
  });
  assert(created.status === 201, `创建临时计划「${name}」（id=${created.body?.id}）`);
  return created.body.id;
}

const withBothDates = [shiftDays(-4), shiftDays(-3), shiftDays(-2)];
const onlyTargetDate = shiftDays(-5);
// 区间之外再留一天「A+B」：批删够不到它，用来验证展开行的按 id 单条删除。
const outsideDate = shiftDays(-25);
const planId = await createPlan(
  PLAN_NAME,
  [
    ...withBothDates.map((scheduledDate) => ({
      scheduledDate,
      items: [
        { exerciseId: target.id, targets: { sets: 3 } },
        { exerciseId: other.id, targets: { sets: 3 } }
      ]
    })),
    { scheduledDate: onlyTargetDate, items: [{ exerciseId: target.id, targets: { sets: 3 } }] },
    {
      scheduledDate: outsideDate,
      items: [
        { exerciseId: target.id, targets: { sets: 3 } },
        { exerciseId: other.id, targets: { sets: 3 } }
      ]
    }
  ]
);
const otherPlanId = await createPlan(OTHER_PLAN_NAME, [
  { scheduledDate: shiftDays(-3), items: [{ exerciseId: target.id, targets: { sets: 3 } }] }
]);

const filter = { planId, startDate: shiftDays(-6), endDate: shiftDays(-1) };
const filterQuery = `planId=${planId}&startDate=${filter.startDate}&endDate=${filter.endDate}`;

try {
  const planSessions = await api(`/training-sessions?planId=${planId}&pageSize=50`);
  const targetSessions = planSessions.body.sessions.filter((session) => withBothDates.includes(session.scheduledDate));
  const onlyTarget = planSessions.body.sessions.find((session) => session.scheduledDate === onlyTargetDate);
  assert(targetSessions.length === 3 && onlyTarget, '列出的单元里带上了每个训练项目的 id 和位置');

  // 预览：作用范围 = 当前筛选条件；只剩一个项目的那天不可删。
  const preview = await api(`/training-session-items/delete-preview?exerciseId=${target.id}&${filterQuery}`);
  assert(preview.status === 200, '删除预览返回 200');
  assert(preview.body.exerciseName === target.name, `预览认到了训练项目「${preview.body.exerciseName}」`);
  assert(preview.body.matchedSessionCount === 4, `预览命中 4 个训练单元（实际 ${preview.body.matchedSessionCount}）`);
  assert(preview.body.matchedItemCount === 4, `命中的训练内容有 4 条（实际 ${preview.body.matchedItemCount}）`);
  assert(preview.body.deletableItemCount === 3, `其中可删 3 条（实际 ${preview.body.deletableItemCount}）`);
  assert(preview.body.skippedCount === 1, '剩一个项目的那天会被跳过');
  assert(preview.body.executionItemCount === 0, '这批训练内容都还没有打卡记录');

  // 数量确认：不带 expectedCount 直接拒绝；对不上 409 且一行不动。
  const withoutCount = await api('/training-session-items', {
    method: 'DELETE',
    body: JSON.stringify({ exerciseId: target.id, filter })
  });
  assert(
    withoutCount.status === 400 && withoutCount.body.code === 'SESSION_ITEM_DELETE_COUNT_REQUIRED',
    '不带 expectedCount 的批删被拒绝'
  );
  const wrongCount = await api('/training-session-items', {
    method: 'DELETE',
    body: JSON.stringify({ exerciseId: target.id, filter, expectedCount: 1 })
  });
  assert(
    wrongCount.status === 409 && wrongCount.body.code === 'SESSION_ITEM_DELETE_COUNT_CHANGED',
    `数量对不上被拒绝（声明 1 条 / 实际 ${wrongCount.body?.details?.matchedCount} 条）`
  );
  const untouched = await api(`/training-sessions?planId=${planId}&pageSize=50`);
  assert(
    untouched.body.sessions.every((session) => session.exercises.some((item) => item.name === target.name)),
    '被拒绝的删除没有动数据'
  );

  // 按项目批删。
  const removed = await api('/training-session-items', {
    method: 'DELETE',
    body: JSON.stringify({ exerciseId: target.id, filter, expectedCount: 3 })
  });
  assert(removed.status === 200 && removed.body.scope === 'exercise', '按训练项目批删返回 200');
  assert(removed.body.deletedCount === 3, `删掉 3 条训练内容（实际 ${removed.body.deletedCount}）`);
  assert(removed.body.affectedSessionCount === 3, `影响 3 个训练单元（实际 ${removed.body.affectedSessionCount}）`);
  assert(removed.body.skippedCount === 1 && removed.body.skipReason === 'last_item', '跳过 1 个只剩这个项目的单元');

  const afterBatch = await api(`/training-sessions?planId=${planId}&pageSize=50`);
  const keptNames = (session) => session.exercises.map((item) => item.name);
  assert(
    afterBatch.body.sessions
      .filter((session) => withBothDates.includes(session.scheduledDate))
      .every((session) => keptNames(session).length === 1 && keptNames(session)[0] === other.name),
    '目标单元里只剩另一个项目，单元本身还在'
  );
  const onlyTargetAfter = afterBatch.body.sessions.find((session) => session.scheduledDate === onlyTargetDate);
  assert(keptNames(onlyTargetAfter).includes(target.name), '只剩一个项目的单元没有被删空');
  const otherPlanAfter = await api(`/training-sessions?planId=${otherPlanId}&pageSize=50`);
  assert(
    otherPlanAfter.body.sessions[0].exercises.some((item) => item.name === target.name),
    '别的计划不受影响（作用范围认 planId）'
  );

  // 展开行的单条删除：只在“还有两个项目”的单元里能删掉，最后一个项目同样会被跳过。
  const otherItemId = onlyTargetAfter.exercises.find((item) => item.name === target.name).id;
  const lastOne = await api('/training-session-items', { method: 'DELETE', body: JSON.stringify({ ids: [otherItemId] }) });
  assert(
    lastOne.status === 200 && lastOne.body.deletedCount === 0 && lastOne.body.skippedCount === 1,
    '按 id 删最后一个项目同样被跳过'
  );
  const outsideSession = afterBatch.body.sessions.find((session) => session.scheduledDate === outsideDate);
  assert(outsideSession.exercises.length === 2, '区间外的那天没被批删碰到');
  const outsideItemId = outsideSession.exercises.find((item) => item.name === target.name).id;
  const single = await api('/training-session-items', {
    method: 'DELETE',
    body: JSON.stringify({ ids: [outsideItemId, 999999] })
  });
  assert(
    single.status === 200 && single.body.scope === 'ids' && single.body.deletedCount === 1,
    `按 id 删掉 1 条训练内容，不存在的 id 静默略过（删除 ${single.body.deletedCount} 条）`
  );
  const finalList = await api(`/training-sessions?planId=${planId}&pageSize=50`);
  assert(
    finalList.body.sessions.some((session) => session.exercises.length === 0) === false,
    '所有训练单元都还有训练内容（没有空单元）'
  );

  console.log('验收通过：训练内容的批量删除链路正常。');
} finally {
  for (const id of [planId, otherPlanId]) {
    const removedPlan = await api(`/training-plans/${id}`, { method: 'DELETE' });
    console.log(`清理：临时计划 ${id} 删除状态 ${removedPlan.status}`);
  }
}
