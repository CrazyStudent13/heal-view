// 训练计划的两个正交维度：生命周期（由日期推导）与达成度（由训练单元和导入记录派生）。
//
// 这里的日期一律相对"今天"推导，避免硬编码日期随时间腐烂：计划区间可能滑出过去或未来，
// 让"已过期才算分母"这类断言在任意一天运行时都成立。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../server/src/config/index.js';
import {
  createTrainingPhase,
  createTrainingPlan,
  createTrainingSession,
  getTrainingPlan,
  listTrainingPlans,
  listTrainingSessions,
  updateTrainingPlan,
  updateTrainingPlanArchived
} from '../../server/src/controllers/trainingPlanController.js';
import { resolvePlanLifecycle } from '../../server/src/services/planAdherence.js';
import { todayDateKey } from '../../server/src/services/sportRecordRepository.js';
import {
  getTrainingExecution,
  saveTrainingSessionExecution
} from '../../server/src/controllers/trainingExecutionController.js';
import { databaseService } from '../../server/src/services/database.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send() {
      return this;
    }
  };
}

/** 相对今天偏移若干天的日期键；按 UTC 午夜做算术，不涉及时区偏移。 */
function shiftDays(dateKey, delta) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * 在临时库上跑一段用例。
 * 必须覆盖 config.dbPath，否则会写到真实的 server/health_data.db。
 */
async function withTempDatabase(run) {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-plan-adherence-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    await run(databaseService.getDb());
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function lastInsertId() {
  return Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}

function insertAerobicExercise(db, { name, sportTypes, metrics = '["duration","distance"]', mode = 'auto' }) {
  db.run(
    `INSERT INTO training_exercises
      (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, sport_types, enabled, created_at, updated_at)
     VALUES (?, 'mdi:walk', 'aerobic', 'indoor', ?, 'equipment', 'Treadmill', ?, 'Cardio', ?, 1, ?, ?)`,
    [name, mode, metrics, JSON.stringify(sportTypes), Date.now(), Date.now()]
  );
  return lastInsertId();
}

/** 只能靠人工打卡的项目：没有导入数据可以对，达标与否完全取决于有没有留下执行记录。 */
function insertManualExercise(db, { name, metrics = '["sets"]' }) {
  db.run(
    `INSERT INTO training_exercises
      (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, sport_types, enabled, created_at, updated_at)
     VALUES (?, 'mdi:arm-flex', 'strength', 'indoor', 'manual', 'bodyweight', '', ?, 'Strength', '[]', 1, ?, ?)`,
    [name, metrics, Date.now(), Date.now()]
  );
  return lastInsertId();
}

function insertSportRecord(db, { date, duration = null, distance = null, category = 'walking', sportType = 2 }) {
  const value = JSON.stringify({ sport_type: sportType, category, start_time: 1, duration, distance });
  db.run(
    `INSERT INTO sport_records (uid, sid, category, "key", time, date, value, parsed_value, update_time)
     VALUES ('test', 'test', ?, ?, 1, ?, ?, ?, ?)`,
    [category, category, date, value, value, Date.now()]
  );
}

function createPlan(body) {
  const response = responseRecorder();
  createTrainingPlan({ body: { name: 'Adherence plan', ...body } }, response);
  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  return response.body;
}

function createSession(planId, body) {
  const response = responseRecorder();
  createTrainingSession({ params: { planId }, body }, response);
  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  return response.body;
}

function createCancelledPhase(planId, { startDate, endDate }) {
  const response = responseRecorder();
  createTrainingPhase(
    { params: { planId }, body: { name: 'Cancelled block', startDate, endDate, status: 'cancelled' } },
    response
  );
  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  return response.body;
}

function planFromList(planId, query = {}) {
  const response = responseRecorder();
  listTrainingPlans({ query }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  return response.body.plans.find((plan) => plan.id === planId) || null;
}

function sessionList(query = {}) {
  const response = responseRecorder();
  listTrainingSessions({ query }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  return response.body;
}

const listedSessionIds = (body) => body.sessions.map((session) => session.id);

function planDetail(planId) {
  const response = responseRecorder();
  getTrainingPlan({ params: { id: planId } }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  return response.body;
}

test('counts extra training days in the numerator so the rate can exceed 100%', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const exerciseId = insertAerobicExercise(db, { name: 'Brisk walking', sportTypes: ['walking'] });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 10) });

    // 两个训练日：一个达标、一个部分达标，于是履约 2 天，分母 2 天。
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -8),
      items: [{ exerciseId, targets: { duration: 30, distance: 3 } }]
    });
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -7),
      items: [{ exerciseId, targets: { duration: 30, distance: 3 } }]
    });
    insertSportRecord(db, { date: shiftDays(today, -8), duration: 1900, distance: 3400 });
    insertSportRecord(db, { date: shiftDays(today, -7), duration: 1500, distance: 1500 });

    // 三个没有训练单元的空闲日，但当天练了该计划认的运动类型 → 加练日。
    const extraDates = [shiftDays(today, -6), shiftDays(today, -5), shiftDays(today, -4)];
    for (const date of extraDates) {
      insertSportRecord(db, { date, duration: 3600, distance: 5000 });
    }

    const listed = planFromList(plan.id);
    assert.equal(listed.adherence.eligibleDays, 2);
    assert.equal(listed.adherence.fulfilledDays, 2);
    assert.equal(listed.adherence.extraDays, 3);
    assert.equal(listed.adherence.completedDays, listed.adherence.fulfilledDays + listed.adherence.extraDays);
    assert.equal(listed.adherence.completedDays, 5);
    assert.equal(listed.adherence.rate, 2.5);
    assert.ok(listed.adherence.rate > 1);
    assert.equal(listed.adherence.tier, 'complete');

    // 生命周期、归档位和达成度是并列的字段；旧的单维 status 口径已经不返回。
    assert.equal(listed.lifecycle, 'active');
    assert.equal(listed.archived, false);
    assert.equal(listed.archivedAt, null);
    assert.equal(listed.status, undefined);
    assert.equal(listed.completedTrainingDayCount, undefined);

    const detail = planDetail(plan.id);
    assert.deepEqual(detail.extraTrainingDates, extraDates);
    assert.equal(detail.adherence.extraDays, 3);
    assert.equal(detail.adherence.rate, 2.5);
  });
});

test('only counts extra days whose imported record matches the plan sport types', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const exerciseId = insertAerobicExercise(db, { name: 'Brisk walking', sportTypes: ['walking'] });
    const plan = createPlan({ startDate: shiftDays(today, -6), endDate: shiftDays(today, 6) });
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -5),
      items: [{ exerciseId, targets: { duration: 30 } }]
    });
    insertSportRecord(db, { date: shiftDays(today, -5), duration: 1900 });

    // 空闲日上只有一条跑步记录，和计划里的健走项目不匹配 → 不算加练。
    insertSportRecord(db, { date: shiftDays(today, -4), duration: 3600, category: 'running', sportType: 1 });
    const withoutMatch = planFromList(plan.id);
    assert.equal(withoutMatch.adherence.extraDays, 0);
    assert.deepEqual(planDetail(plan.id).extraTrainingDates, []);

    // 同一个计划下换成匹配的健走记录才计入加练。
    insertSportRecord(db, { date: shiftDays(today, -3), duration: 3600, category: 'walking', sportType: 2 });
    const withMatch = planFromList(plan.id);
    assert.equal(withMatch.adherence.extraDays, 1);
    assert.equal(withMatch.adherence.fulfilledDays, 1);
    assert.equal(withMatch.adherence.rate, 2);
    assert.deepEqual(planDetail(plan.id).extraTrainingDates, [shiftDays(today, -3)]);
  });
});

test('keeps future training days out of the denominator', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const exerciseId = insertAerobicExercise(db, { name: 'Brisk walking', sportTypes: ['walking'] });
    const plan = createPlan({ startDate: shiftDays(today, -5), endDate: shiftDays(today, 5) });

    // 未来日期的训练单元还没到期，不进分母也不进分子。
    createSession(plan.id, {
      scheduledDate: shiftDays(today, 3),
      items: [{ exerciseId, targets: { duration: 30 } }]
    });
    assert.equal(planFromList(plan.id).adherence.eligibleDays, 0);
    assert.equal(planFromList(plan.id).adherence.rate, null);
    assert.equal(planFromList(plan.id).adherence.tier, null);

    // 只有已过期的那个训练日进分母。
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -2),
      status: 'achieved',
      items: [{ exerciseId, targets: { duration: 30 } }]
    });
    const listed = planFromList(plan.id);
    assert.equal(listed.adherence.eligibleDays, 1);
    assert.equal(listed.adherence.fulfilledDays, 1);
    assert.equal(listed.adherence.rate, 1);
  });
});

test('drops every day covered by a cancelled phase from the adherence denominator and numerator', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const exerciseId = insertAerobicExercise(db, { name: 'Brisk walking', sportTypes: ['walking'] });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 10) });

    for (const offset of [-8, -7, -6]) {
      createSession(plan.id, {
        scheduledDate: shiftDays(today, offset),
        status: 'achieved',
        items: [{ exerciseId, targets: { duration: 30 } }]
      });
    }

    const before = planFromList(plan.id);
    assert.equal(before.adherence.eligibleDays, 3);
    assert.equal(before.adherence.fulfilledDays, 3);
    assert.equal(before.adherence.rate, 1);

    // 取消阶段覆盖 -7 与 -6 两个训练日，以及 -5 这个空闲日。
    createCancelledPhase(plan.id, { startDate: shiftDays(today, -7), endDate: shiftDays(today, -5) });
    // -5 落在被取消的区间里，即使有匹配的导入记录也不能算加练。
    insertSportRecord(db, { date: shiftDays(today, -5), duration: 3600 });

    const after = planFromList(plan.id);
    assert.equal(after.adherence.eligibleDays, 1);
    assert.equal(after.adherence.fulfilledDays, 1);
    assert.equal(after.adherence.extraDays, 0);
    assert.equal(after.adherence.rate, 1);
    assert.equal(after.adherence.tier, 'complete');
    assert.deepEqual(planDetail(plan.id).extraTrainingDates, []);
  });
});

test('derives the plan lifecycle from its dates while archive state stays orthogonal', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();

    const draftPlan = createPlan({ startDate: shiftDays(today, 3), endDate: shiftDays(today, 10) });
    const activePlan = createPlan({ startDate: shiftDays(today, -3), endDate: shiftDays(today, 3) });
    const endedPlan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, -3) });

    assert.equal(draftPlan.lifecycle, 'draft');
    assert.equal(activePlan.lifecycle, 'active');
    assert.equal(endedPlan.lifecycle, 'ended');

    assert.equal(planFromList(draftPlan.id).lifecycle, 'draft');
    assert.equal(planFromList(activePlan.id).lifecycle, 'active');
    assert.equal(planFromList(endedPlan.id).lifecycle, 'ended');

    // 边界按半开区间之外的包含处理：起止当天都算进行中。
    assert.equal(resolvePlanLifecycle({ startDate: today, endDate: shiftDays(today, 5) }, today).lifecycle, 'active');
    assert.equal(resolvePlanLifecycle({ startDate: shiftDays(today, -5), endDate: today }, today).lifecycle, 'active');
    assert.equal(
      resolvePlanLifecycle({ startDate: shiftDays(today, 1), endDate: shiftDays(today, 5) }, today).lifecycle,
      'draft'
    );
    assert.equal(
      resolvePlanLifecycle({ startDate: shiftDays(today, -5), endDate: shiftDays(today, -1) }, today).lifecycle,
      'ended'
    );
  });
});

test('archives a plan out of the default list and restores it, rejecting non-boolean input', async () => {
  await withTempDatabase(async () => {
    const today = todayDateKey();
    const plan = createPlan({ startDate: shiftDays(today, -5), endDate: shiftDays(today, 5) });
    assert.ok(planFromList(plan.id));

    const archivedResponse = responseRecorder();
    updateTrainingPlanArchived({ params: { id: plan.id }, body: { archived: true } }, archivedResponse);
    assert.equal(archivedResponse.statusCode, 200);
    assert.equal(archivedResponse.body.archived, true);
    assert.equal(typeof archivedResponse.body.archivedAt, 'number');
    assert.ok(archivedResponse.body.archivedAt > 0);
    // 归档只是一个意图位，不改变由日期推导出来的生命周期。
    assert.equal(archivedResponse.body.lifecycle, 'active');

    assert.equal(planFromList(plan.id), null);
    const withArchived = planFromList(plan.id, { includeArchived: 'true' });
    assert.ok(withArchived);
    assert.equal(withArchived.archived, true);
    assert.equal(withArchived.archivedAt, archivedResponse.body.archivedAt);

    const restoredResponse = responseRecorder();
    updateTrainingPlanArchived({ params: { id: plan.id }, body: { archived: false } }, restoredResponse);
    assert.equal(restoredResponse.statusCode, 200);
    assert.equal(restoredResponse.body.archived, false);
    assert.equal(restoredResponse.body.archivedAt, null);

    const restored = planFromList(plan.id);
    assert.ok(restored);
    assert.equal(restored.archived, false);
    assert.equal(restored.archivedAt, null);

    for (const body of [{ archived: 'true' }, { archived: 1 }, { archived: null }, {}]) {
      const invalidResponse = responseRecorder();
      updateTrainingPlanArchived({ params: { id: plan.id }, body }, invalidResponse);
      assert.equal(invalidResponse.statusCode, 400, JSON.stringify(body));
      assert.ok(invalidResponse.body.fields.archived);
    }
    // 无效请求不能改动归档状态。
    assert.equal(planFromList(plan.id).archived, false);
  });
});

test('refuses to shrink the end date of a started plan but allows it for a draft plan', async () => {
  await withTempDatabase(async () => {
    const today = todayDateKey();

    const started = createPlan({ startDate: shiftDays(today, -5), endDate: shiftDays(today, 5) });
    const shrinkResponse = responseRecorder();
    updateTrainingPlan(
      {
        params: { id: started.id },
        body: { name: started.name, startDate: started.startDate, endDate: shiftDays(today, 2) }
      },
      shrinkResponse
    );
    assert.equal(shrinkResponse.statusCode, 409);
    assert.equal(shrinkResponse.body.code, 'PLAN_END_DATE_CANNOT_SHRINK');
    assert.equal(planDetail(started.id).endDate, shiftDays(today, 5));

    // 已开始的计划只能延长，延长是允许的。
    const extendResponse = responseRecorder();
    updateTrainingPlan(
      {
        params: { id: started.id },
        body: { name: started.name, startDate: started.startDate, endDate: shiftDays(today, 12) }
      },
      extendResponse
    );
    assert.equal(extendResponse.statusCode, 200);
    assert.equal(extendResponse.body.endDate, shiftDays(today, 12));

    // 还没开始的计划缩短结束日期是自由的。
    const draft = createPlan({ startDate: shiftDays(today, 10), endDate: shiftDays(today, 30) });
    const draftShrinkResponse = responseRecorder();
    updateTrainingPlan(
      {
        params: { id: draft.id },
        body: { name: draft.name, startDate: draft.startDate, endDate: shiftDays(today, 15) }
      },
      draftShrinkResponse
    );
    assert.equal(draftShrinkResponse.statusCode, 200, JSON.stringify(draftShrinkResponse.body));
    assert.equal(draftShrinkResponse.body.endDate, shiftDays(today, 15));
    assert.equal(draftShrinkResponse.body.lifecycle, 'draft');
  });
});

test('reports a null rate and tier when there is no elapsed training day to divide by', async () => {
  await withTempDatabase(async () => {
    const today = todayDateKey();
    const plan = createPlan({ startDate: shiftDays(today, -5), endDate: shiftDays(today, 5) });

    const listed = planFromList(plan.id);
    assert.equal(listed.adherence.eligibleDays, 0);
    assert.equal(listed.adherence.fulfilledDays, 0);
    assert.equal(listed.adherence.extraDays, 0);
    assert.equal(listed.adherence.completedDays, 0);
    assert.equal(listed.adherence.rate, null);
    // 没有分母时是"暂无"，不能误报成"完全缺席"。
    assert.equal(listed.adherence.tier, null);
    assert.notEqual(listed.adherence.tier, 'absent');
    assert.equal(planDetail(plan.id).adherence.tier, null);
  });
});

test('counts a partially achieved training day as fulfilled', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const exerciseId = insertAerobicExercise(db, { name: 'Brisk walking', sportTypes: ['walking'] });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 10) });
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -5),
      items: [{ exerciseId, targets: { duration: 30, distance: 3 } }]
    });
    // 时长差一点、距离只完成一半 → 派生状态 partial，但人来了卡就算打了。
    insertSportRecord(db, { date: shiftDays(today, -5), duration: 1500, distance: 1500 });

    const detail = planDetail(plan.id);
    assert.equal(detail.sessions[0].status, 'partial');

    const listed = planFromList(plan.id);
    assert.equal(listed.adherence.eligibleDays, 1);
    assert.equal(listed.adherence.fulfilledDays, 1);
    assert.equal(listed.adherence.extraDays, 0);
    assert.equal(listed.adherence.rate, 1);
    assert.equal(listed.adherence.tier, 'complete');
  });
});

test('ignores a status field on plan creation now that status is derived', async () => {
  await withTempDatabase(async () => {
    const today = todayDateKey();
    const plan = createPlan({ startDate: shiftDays(today, -2), endDate: shiftDays(today, 4), status: 'archived' });

    // 创建计划不再接受 status：既不能伪造归档，也不能覆盖推导出来的生命周期。
    assert.equal(plan.archived, false);
    assert.equal(plan.archivedAt, null);
    assert.equal(plan.lifecycle, 'active');
    assert.equal(plan.status, undefined);
    assert.ok(planFromList(plan.id));
  });
});

// "无数据算缺席"要想立得住，漏打卡就必须能补。这条用例把补卡的完整链路固化下来：
// 过去的训练日 → 手机端读到待确认项目 → 保存执行记录 → 达成度立即重算。
test('flips a past training day to fulfilled when it is backfilled through the execution endpoint', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const exerciseId = insertManualExercise(db, { name: 'Sit-up' });
    const plan = createPlan({ startDate: shiftDays(today, -5), endDate: shiftDays(today, 5) });
    const session = createSession(plan.id, {
      scheduledDate: shiftDays(today, -2),
      items: [{ exerciseId, targets: { sets: 3 } }]
    });

    // 人工项目没确认，这天在打卡口径下就是缺席。
    const before = planFromList(plan.id);
    assert.equal(before.adherence.eligibleDays, 1);
    assert.equal(before.adherence.fulfilledDays, 0);
    assert.equal(before.adherence.rate, 0);
    assert.equal(before.adherence.tier, 'absent');
    assert.equal(planDetail(plan.id).sessions[0].status, 'planned');

    // 手机端切回过去那一天，能读到这个待确认项目。
    const dayResponse = responseRecorder();
    getTrainingExecution({ query: { date: shiftDays(today, -2) } }, dayResponse);
    assert.equal(dayResponse.statusCode, 200);
    const entry = dayResponse.body.sessions.find((item) => item.planId === plan.id);
    assert.ok(entry, '过去的日期依然能读到训练单元');
    assert.equal(entry.items.length, 1);

    const saveResponse = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: session.id },
        body: {
          status: 'completed',
          items: [{ sessionItemId: entry.items[0].sessionItemId, status: 'done', actuals: { sets: 3 } }]
        }
      },
      saveResponse
    );
    assert.equal(saveResponse.statusCode, 200, JSON.stringify(saveResponse.body));

    // 达成度是读取时重算的，补卡后立刻反映出来，分母不变。
    const after = planFromList(plan.id);
    assert.equal(after.adherence.eligibleDays, 1);
    assert.equal(after.adherence.fulfilledDays, 1);
    assert.equal(after.adherence.rate, 1);
    assert.equal(after.adherence.tier, 'complete');
    assert.equal(planDetail(plan.id).sessions[0].status, 'achieved');
  });
});

// 全局训练单元页只按完成状态筛选，而且筛的是推导出来的状态：
// s.status 存的是人工结论，导入数据匹配出的达标和部分达标从不写回，SQL 里根本筛不到。
test('filters the global session list by derived completion status', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const aerobicId = insertAerobicExercise(db, { name: 'Brisk walking', sportTypes: ['walking'] });
    const manualId = insertManualExercise(db, { name: 'Plank' });
    const plan = createPlan({ startDate: shiftDays(today, -12), endDate: shiftDays(today, 10) });

    // 达标两天：只能靠导入记录推出来，存量的 s.status 一直是 planned。
    const achievedNewest = createSession(plan.id, {
      scheduledDate: shiftDays(today, -6),
      items: [{ exerciseId: aerobicId, targets: { duration: 30, distance: 3 } }]
    });
    insertSportRecord(db, { date: shiftDays(today, -6), duration: 1900, distance: 3400 });
    const achievedOlder = createSession(plan.id, {
      scheduledDate: shiftDays(today, -7),
      items: [{ exerciseId: aerobicId, targets: { duration: 30, distance: 3 } }]
    });
    insertSportRecord(db, { date: shiftDays(today, -7), duration: 1900, distance: 3400 });
    // 有记录但没达到目标 → 部分达标。
    const partial = createSession(plan.id, {
      scheduledDate: shiftDays(today, -5),
      items: [{ exerciseId: aerobicId, targets: { duration: 30, distance: 3 } }]
    });
    insertSportRecord(db, { date: shiftDays(today, -5), duration: 1500, distance: 1500 });
    // 全人工项目、过去的日子、还没打卡 → 未完成。
    const missed = createSession(plan.id, {
      scheduledDate: shiftDays(today, -4),
      items: [{ exerciseId: manualId, targets: { sets: 3 } }]
    });
    // 自动项目但当天没有任何导入记录 → 无数据，不并进未完成。
    const noData = createSession(plan.id, {
      scheduledDate: shiftDays(today, -3),
      items: [{ exerciseId: aerobicId, targets: { duration: 30 } }]
    });
    // 还没到的日子保持待开始。
    const upcoming = createSession(plan.id, {
      scheduledDate: shiftDays(today, 3),
      items: [{ exerciseId: aerobicId, targets: { duration: 30 } }]
    });
    // 人工项目全部跳过 → 已跳过，执行记录优先于"没打卡"。
    const skipped = createSession(plan.id, {
      scheduledDate: shiftDays(today, -9),
      items: [{ exerciseId: manualId, targets: { sets: 3 } }]
    });
    const skippedDay = responseRecorder();
    getTrainingExecution({ query: { date: shiftDays(today, -9) } }, skippedDay);
    const skippedItem = skippedDay.body.sessions.find((entry) => entry.planId === plan.id).items[0];
    const skippedSave = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: skipped.id },
        body: { status: 'skipped', items: [{ sessionItemId: skippedItem.sessionItemId, status: 'skipped' }] }
      },
      skippedSave
    );
    assert.equal(skippedSave.statusCode, 200, JSON.stringify(skippedSave.body));

    const listed = sessionList({ planId: String(plan.id) });
    assert.equal(listed.total, 7);
    const statusById = new Map(listed.sessions.map((session) => [session.id, session.status]));
    assert.equal(statusById.get(achievedNewest.id), 'achieved');
    assert.equal(statusById.get(achievedOlder.id), 'achieved');
    assert.equal(statusById.get(partial.id), 'partial');
    assert.equal(statusById.get(skipped.id), 'skipped');
    assert.equal(statusById.get(missed.id), 'missed');
    assert.equal(statusById.get(noData.id), 'no_data');
    assert.equal(statusById.get(upcoming.id), 'planned');

    // 四个完成状态各筛各的；过滤发生在分页之前，所以 total 也是过滤后的数量。
    assert.equal(sessionList({ planId: String(plan.id), status: 'achieved' }).total, 2);
    assert.deepEqual(listedSessionIds(sessionList({ planId: String(plan.id), status: 'achieved' })), [
      achievedNewest.id,
      achievedOlder.id
    ]);
    assert.deepEqual(listedSessionIds(sessionList({ planId: String(plan.id), status: 'partial' })), [partial.id]);
    assert.deepEqual(listedSessionIds(sessionList({ planId: String(plan.id), status: 'skipped' })), [skipped.id]);
    assert.deepEqual(listedSessionIds(sessionList({ planId: String(plan.id), status: 'missed' })), [missed.id]);

    const paged = sessionList({ planId: String(plan.id), status: 'achieved', page: '2', pageSize: '1' });
    assert.equal(paged.total, 2);
    assert.deepEqual(listedSessionIds(paged), [achievedOlder.id]);

    // 待开始、无数据、无法验证已经不再是筛选项：传进来不生效，退回"全部"。
    for (const ignored of ['planned', 'no_data', 'unverifiable']) {
      const body = sessionList({ planId: String(plan.id), status: ignored });
      assert.equal(body.total, 7, `${ignored} 不该再参与筛选`);
    }
  });
});
