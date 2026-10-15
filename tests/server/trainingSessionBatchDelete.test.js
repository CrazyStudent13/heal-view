// 训练单元列表的复合条件检索与批量删除。
//
// 这里的重点是两条链路共用同一套条件：列表看到多少行，"删掉筛选结果"就删多少行。
// 反过来，破坏性入口对条件的校验要比列表严——列表可以忽略认不出的条件，删除不行，
// 否则用户会以为自己在删一个受限的子集，实际删掉的是更大的一批。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../server/src/config/index.js';
import {
  createTrainingPlan,
  createTrainingSession,
  deleteTrainingSessions,
  getTrainingPlan,
  listTrainingSessions
} from '../../server/src/controllers/trainingPlanController.js';
import {
  getTrainingExecution,
  saveTrainingSessionExecution
} from '../../server/src/controllers/trainingExecutionController.js';
import { todayDateKey } from '../../server/src/services/sportRecordRepository.js';
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-session-batch-'));
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

/** 插入一个训练项目并返回它的 id（不是行对象）。 */
function insertExercise(db, { name, mode = 'manual', metrics = '["sets"]', sportTypes = [] }) {
  db.run(
    `INSERT INTO training_exercises
      (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, sport_types, enabled, created_at, updated_at)
     VALUES (?, 'mdi:walk', 'strength', 'indoor', ?, 'bodyweight', '', ?, 'Test', ?, 1, ?, ?)`,
    [name, mode, metrics, JSON.stringify(sportTypes), Date.now(), Date.now()]
  );
  return lastInsertId();
}

function insertSportRecord(db, { date, duration = null, distance = null, category = 'walking' }) {
  const value = JSON.stringify({ sport_type: 2, category, start_time: 1, duration, distance });
  db.run(
    `INSERT INTO sport_records (uid, sid, category, "key", time, date, value, parsed_value, update_time)
     VALUES ('test', 'test', ?, ?, 1, ?, ?, ?, ?)`,
    [category, category, date, value, value, Date.now()]
  );
}

function createPlan(body) {
  const response = responseRecorder();
  createTrainingPlan({ body: { name: 'Batch plan', ...body } }, response);
  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  return response.body;
}

function createSession(planId, body) {
  const response = responseRecorder();
  createTrainingSession({ params: { planId }, body }, response);
  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  return response.body;
}

function sessionList(query = {}) {
  const response = responseRecorder();
  listTrainingSessions({ query }, response);
  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  return response.body;
}

const listedIds = (body) => body.sessions.map((session) => session.id);

function batchDelete(body) {
  const response = responseRecorder();
  deleteTrainingSessions({ body }, response);
  return response;
}

function countRows(sql, params = []) {
  return Number(databaseService.query(sql, params)[0].values[0][0]);
}

/** 给训练单元留下一条人工打卡记录，用来验证批量删除会级联清掉执行记录。 */
function backfill(session) {
  const dayResponse = responseRecorder();
  getTrainingExecution({ query: { date: session.scheduledDate } }, dayResponse);
  assert.equal(dayResponse.statusCode, 200, JSON.stringify(dayResponse.body));
  const entry = dayResponse.body.sessions.find((item) => item.sessionId === session.id);
  assert.ok(entry, '应能读到刚创建的训练单元');
  const saveResponse = responseRecorder();
  saveTrainingSessionExecution(
    {
      params: { id: session.id },
      body: {
        status: 'completed',
        items: entry.items.map((item) => ({
          sessionItemId: item.sessionItemId,
          status: 'done',
          actuals: { sets: 3 }
        }))
      }
    },
    saveResponse
  );
  assert.equal(saveResponse.statusCode, 200, JSON.stringify(saveResponse.body));
}

test('combines date range, plan, derived status, and training content when listing sessions', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const walking = insertExercise(db, {
      name: 'Brisk walking',
      mode: 'auto',
      metrics: '["duration"]',
      sportTypes: ['walking']
    });
    const plank = insertExercise(db, { name: 'Plank' });
    const planA = createPlan({ name: 'Plan A', startDate: shiftDays(today, -20), endDate: shiftDays(today, 5) });
    const planB = createPlan({ name: 'Plan B', startDate: shiftDays(today, -20), endDate: shiftDays(today, 5) });

    const cardio = createSession(planA.id, {
      scheduledDate: shiftDays(today, -8),
      name: 'Morning cardio',
      notes: 'felt strong today',
      items: [{ exerciseId: walking, targets: { duration: 30 } }]
    });
    insertSportRecord(db, { date: shiftDays(today, -8), duration: 3600 });
    const missedWithPlank = createSession(planA.id, {
      scheduledDate: shiftDays(today, -7),
      items: [{ exerciseId: plank, targets: { sets: 3 } }]
    });
    const mistake = createSession(planA.id, {
      scheduledDate: shiftDays(today, -2),
      notes: 'added by accident',
      items: [{ exerciseId: plank, targets: { sets: 3 } }]
    });
    const upcoming = createSession(planA.id, {
      scheduledDate: shiftDays(today, 3),
      items: [{ exerciseId: walking, targets: { duration: 30 } }]
    });
    const otherPlan = createSession(planB.id, {
      scheduledDate: shiftDays(today, -7),
      items: [{ exerciseId: plank, targets: { sets: 3 } }]
    });

    // 关键词只匹配训练内容（训练项目名），三行项目是 Plank 的都会被带出来。
    assert.deepEqual(
      listedIds(sessionList({ search: 'Plank' })).sort((a, b) => a - b),
      [missedWithPlank.id, mistake.id, otherPlan.id].sort((a, b) => a - b)
    );

    // 单元名称和备注是自由文本，不参与这个条件：搜它们必须是 0 条，而不是"也能搜到"。
    assert.equal(sessionList({ search: 'Morning cardio' }).total, 0, '单元名称不参与训练内容检索');
    assert.equal(sessionList({ search: 'accident' }).total, 0, '备注不参与训练内容检索');
    assert.equal(sessionList({ search: 'felt strong' }).total, 0, '备注不参与训练内容检索');

    // 关键词里的 % 是 LIKE 通配符，必须当字面量处理，否则这条会匹配到全部单元。
    assert.equal(sessionList({ search: '%' }).total, 0);
    assert.equal(sessionList({ search: '_' }).total, 0);

    // 计划 + 派生完成状态：两个都是"未完成"的人工项目，未来的那个不算。
    assert.equal(sessionList({ planId: String(planA.id), status: 'missed' }).total, 2);
    assert.equal(sessionList({ search: 'Plank', status: 'missed' }).total, 3);
    assert.equal(sessionList({ planId: String(planA.id), search: 'Plank', status: 'missed' }).total, 2);

    // 再叠上日期区间，四个条件是 AND。
    const narrowed = sessionList({
      planId: String(planA.id),
      startDate: shiftDays(today, -9),
      endDate: shiftDays(today, -6),
      status: 'missed',
      search: 'Plank'
    });
    assert.deepEqual(listedIds(narrowed), [missedWithPlank.id]);
    assert.equal(narrowed.total, 1);

    // 关键词和日期区间一起用时，区间之外的那条不会被带回来。
    assert.deepEqual(
      listedIds(sessionList({ planId: String(planA.id), search: 'Plank', startDate: shiftDays(today, -3) })),
      [mistake.id]
    );

    // 按项目名搜会连未来的训练单元一起带出来，关键词不区分计划内外。
    assert.deepEqual(listedIds(sessionList({ search: 'Brisk walking' })).sort(), [cardio.id, upcoming.id].sort());

    // 达标是靠导入记录推出来的：状态筛选认它，SQL 里的 s.status 一直是 planned。
    assert.deepEqual(listedIds(sessionList({ planId: String(planA.id), status: 'achieved' })), [cardio.id]);
    // 待开始、无数据、无法验证不是筛选项：传进来不生效，退回"全部"。
    assert.equal(sessionList({ planId: String(planA.id), status: 'planned' }).total, 4);

    // executionCount 是"匹配结果里已有打卡记录的条数"，删除前用它提示会连带消失的记录。
    assert.equal(sessionList({ planId: String(planA.id) }).executionCount, 0);
    // 打卡状态是一个能在 SQL 里直接筛的条件，和完成状态是两件事：
    // 达标可以来自导入记录（没有打卡行），补卡也会改写完成状态。
    assert.equal(sessionList({ logged: 'true' }).total, 0);
    assert.equal(sessionList({ logged: 'false' }).total, 5);
    assert.equal(sessionList({ planId: String(planA.id), logged: 'false' }).total, 4);

    backfill(mistake);
    assert.equal(sessionList({ planId: String(planA.id) }).executionCount, 1);
    // 人工打卡记录优先：补卡之后这条从"未完成"变成"全部完成"。
    assert.equal(sessionList({ planId: String(planA.id), status: 'missed' }).total, 1);
    assert.deepEqual(
      listedIds(sessionList({ planId: String(planA.id), status: 'achieved' })).sort(),
      [cardio.id, mistake.id].sort()
    );
    assert.equal(sessionList({ search: 'Plank', status: 'achieved' }).executionCount, 1);

    // 打卡状态和训练内容、完成状态可以叠加，而且是 AND。
    assert.deepEqual(listedIds(sessionList({ planId: String(planA.id), logged: 'true' })), [mistake.id]);
    assert.deepEqual(
      listedIds(sessionList({ planId: String(planA.id), logged: 'false' })).sort(),
      [cardio.id, missedWithPlank.id, upcoming.id].sort()
    );
    assert.deepEqual(
      listedIds(sessionList({ search: 'Plank', status: 'missed', logged: 'false' })).sort((a, b) => a - b),
      [missedWithPlank.id, otherPlan.id].sort((a, b) => a - b)
    );
    assert.equal(sessionList({ search: 'Plank', status: 'missed', logged: 'true' }).total, 0);
    // 布尔写法也认，列表这边仍然是宽容的：认不出的值当没给。
    assert.equal(sessionList({ logged: true }).total, 1);
    assert.equal(sessionList({ logged: [] }).total, 5);
  });
});

test('batch deletes selected sessions and cascades their items and check-in records', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const plank = insertExercise(db, { name: 'Plank' });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 5) });
    const kept = createSession(plan.id, {
      scheduledDate: shiftDays(today, -3),
      items: [{ exerciseId: plank, targets: { sets: 3 } }]
    });
    const removed = createSession(plan.id, {
      scheduledDate: shiftDays(today, -2),
      items: [{ exerciseId: plank, targets: { sets: 3 } }]
    });
    backfill(removed);

    assert.equal(countRows('SELECT COUNT(*) FROM training_session_logs WHERE session_id = ?', [removed.id]), 1);

    const response = batchDelete({ ids: [removed.id, 999999] });
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal(response.body.scope, 'ids');
    // 不存在的 id 静默略过：另一个页面可能已经删过它了，这不该让整批回滚。
    assert.deepEqual(response.body.deletedIds, [removed.id]);
    assert.equal(response.body.deletedCount, 1);

    assert.equal(countRows('SELECT COUNT(*) FROM training_sessions WHERE id = ?', [removed.id]), 0);
    assert.equal(
      countRows('SELECT COUNT(*) FROM training_session_items WHERE session_id = ?', [removed.id]),
      0,
      '训练项目应随单元一起被外键级联删掉'
    );
    assert.equal(
      countRows('SELECT COUNT(*) FROM training_session_logs WHERE session_id = ?', [removed.id]),
      0,
      '打卡记录应随单元一起被外键级联删掉'
    );

    // 没被选中的单元和计划本身都还在。
    assert.equal(countRows('SELECT COUNT(*) FROM training_sessions WHERE id = ?', [kept.id]), 1);
    const detail = (() => {
      const detailResponse = responseRecorder();
      getTrainingPlan({ params: { id: plan.id } }, detailResponse);
      assert.equal(detailResponse.statusCode, 200, JSON.stringify(detailResponse.body));
      return detailResponse.body;
    })();
    assert.deepEqual(
      detail.sessions.map((session) => session.id),
      [kept.id]
    );
  });
});

test('batch deletes every row matching the compound filter, not just the current page', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const plank = insertExercise(db, { name: 'Plank' });
    // 加错的那一批配的是另一个项目：检索条件只认训练内容，项目名就是区分它们的依据。
    const mistakenExercise = insertExercise(db, { name: 'Mistaken plank' });
    const plan = createPlan({ startDate: shiftDays(today, -30), endDate: shiftDays(today, 5) });
    const other = createPlan({ name: 'Other', startDate: shiftDays(today, -30), endDate: shiftDays(today, 5) });

    const mistakeIds = [];
    for (let offset = 1; offset <= 12; offset += 1) {
      mistakeIds.push(
        createSession(plan.id, {
          scheduledDate: shiftDays(today, -offset),
          notes: 'batch added by mistake',
          items: [{ exerciseId: mistakenExercise, targets: { sets: 3 } }]
        }).id
      );
    }
    // 同计划、日期区间之外的另一条：项目对不上，不该被这次筛选带走。
    const survivor = createSession(plan.id, {
      scheduledDate: shiftDays(today, -13),
      items: [{ exerciseId: plank, targets: { sets: 3 } }]
    });
    // 同项目但属于别的计划：计划条件会把它挡在外面。
    const otherPlanSession = createSession(other.id, {
      scheduledDate: shiftDays(today, -1),
      notes: 'batch added by mistake',
      items: [{ exerciseId: mistakenExercise, targets: { sets: 3 } }]
    });

    const filter = {
      planId: plan.id,
      startDate: shiftDays(today, -14),
      endDate: shiftDays(today, -1),
      status: 'missed',
      // 这一批一个都没打过卡，所以打卡状态也能当条件用。
      logged: 'false',
      search: 'Mistaken plank'
    };
    // 备注里也写着同一句话，但它不参与检索：这两条筛选命中完全靠训练内容。
    assert.equal(sessionList({ planId: String(plan.id), search: 'by mistake' }).total, 0);
    assert.equal(sessionList({ planId: String(plan.id), search: 'Mistaken plank' }).total, 12);
    assert.equal(sessionList({ planId: String(plan.id), logged: 'true' }).total, 0);

    // 分页只是展示手段：total 就是筛选后的全部行数，所以"删掉筛选结果"不会只删当页。
    const paged = sessionList({ ...filter, page: '2', pageSize: '5' });
    assert.equal(paged.total, 12);
    assert.equal(paged.sessions.length, 5);

    // 数量对不上时必须停住：用户以为删 12 条、实际条件只命中 5 条，这种请求不能执行。
    const mismatched = batchDelete({ filter, expectedCount: 5 });
    assert.equal(mismatched.statusCode, 409, JSON.stringify(mismatched.body));
    assert.equal(mismatched.body.code, 'SESSION_DELETE_COUNT_CHANGED');
    assert.deepEqual(mismatched.body.details, { expectedCount: 5, matchedCount: 12 });
    assert.equal(sessionList({ planId: String(plan.id) }).total, 13, '被拒绝的请求不该删掉任何行');

    // 条件删除必须带数量：没有 expectedCount 直接拒绝，免得调用方"顺手删一批"。
    const withoutCount = batchDelete({ filter });
    assert.equal(withoutCount.statusCode, 400, JSON.stringify(withoutCount.body));
    assert.equal(withoutCount.body.code, 'SESSION_DELETE_COUNT_REQUIRED');

    const response = batchDelete({ filter, expectedCount: 12 });
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    assert.equal(response.body.scope, 'filter');
    assert.equal(response.body.deletedCount, 12);
    assert.deepEqual(
      response.body.deletedIds.slice().sort((a, b) => a - b),
      mistakeIds.slice().sort((a, b) => a - b)
    );

    // 同一份请求再发一次：现在命中 0 条，和声明的 12 条对不上，于是被 409 挡住而不是静默成功。
    const repeated = batchDelete({ filter, expectedCount: 12 });
    assert.equal(repeated.statusCode, 409, JSON.stringify(repeated.body));
    assert.deepEqual(repeated.body.details, { expectedCount: 12, matchedCount: 0 });

    assert.equal(sessionList({ planId: String(plan.id) }).total, 1);
    assert.deepEqual(listedIds(sessionList({ planId: String(plan.id) })), [survivor.id]);
    assert.deepEqual(listedIds(sessionList({ planId: String(other.id) })), [otherPlanSession.id]);
  });
});

test('refuses destructive batch deletes without a usable scope and never touches data', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const plank = insertExercise(db, { name: 'Plank' });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 5) });
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -2),
      items: [{ exerciseId: plank, targets: { sets: 3 } }]
    });

    const cases = [
      [{}, 'SESSION_DELETE_SCOPE_REQUIRED'],
      [{ ids: [] }, 'SESSION_DELETE_SCOPE_REQUIRED'],
      [{ ids: [1], filter: { planId: plan.id } }, 'SESSION_DELETE_SCOPE_INVALID'],
      // 空筛选条件等于"删掉全部训练单元"，必须挡住。
      [{ filter: {} }, 'SESSION_DELETE_FILTER_REQUIRED'],
      // 删除不像列表那样静默忽略认不出的条件：那会让用户以为删的是更小的子集。
      [{ filter: { status: 'planned' } }, 'SESSION_FILTER_INVALID'],
      [{ filter: { planId: 'abc' } }, 'SESSION_FILTER_INVALID'],
      [{ filter: { startDate: '2026-13-01' } }, 'SESSION_FILTER_INVALID'],
      [{ filter: { search: 42 } }, 'SESSION_FILTER_INVALID'],
      [{ filter: { logged: 'yes' } }, 'SESSION_FILTER_INVALID'],
      [{ filter: { logged: '' } }, 'SESSION_FILTER_INVALID'],
      [{ filter: [] }, 'SESSION_FILTER_INVALID'],
      // 条件成立但没有数量确认：不执行，也不猜用户想删几条。
      [{ filter: { planId: plan.id } }, 'SESSION_DELETE_COUNT_REQUIRED'],
      [{ filter: { planId: plan.id }, expectedCount: '1' }, 'SESSION_DELETE_COUNT_REQUIRED'],
      [{ filter: { planId: plan.id }, expectedCount: -1 }, 'SESSION_DELETE_COUNT_REQUIRED'],
      [{ filter: { planId: plan.id }, expectedCount: 1.5 }, 'SESSION_DELETE_COUNT_REQUIRED'],
      [{ ids: ['abc'] }, 'SESSION_DELETE_IDS_INVALID'],
      [{ ids: [0] }, 'SESSION_DELETE_IDS_INVALID'],
      [{ ids: Array.from({ length: 1001 }, (_, index) => index + 1) }, 'SESSION_DELETE_TOO_MANY']
    ];

    for (const [body, code] of cases) {
      const response = batchDelete(body);
      assert.equal(response.statusCode, 400, `${code}: ${JSON.stringify(response.body)}`);
      assert.equal(response.body.code, code, JSON.stringify(body));
    }

    assert.equal(countRows('SELECT COUNT(*) FROM training_sessions'), 1, '被拒绝的请求不该删掉任何行');
    assert.equal(sessionList().total, 1);
  });
});
