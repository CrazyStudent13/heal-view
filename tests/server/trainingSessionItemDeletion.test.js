// 训练单元内"训练项目"的批量删除：按"某个训练项目 + 训练单元列表的复合条件"一次拿掉，
// 以及展开行里的单条删除。
//
// 这里守三条边界：
//   1. 作用范围和列表同源——"列表上筛出来的那批单元"就是被改动的那批；
//   2. 不把任何训练单元删空（只剩一个项目时跳过，并回报跳过的条数）；
//   3. 副本性操作要数量确认：expectedCount 对不上 409，不带 400。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../server/src/config/index.js';
import {
  createTrainingPlan,
  createTrainingSession,
  deleteTrainingSessionItems,
  listTrainingSessions,
  previewTrainingSessionItemDeletion
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

function shiftDays(dateKey, delta) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

async function withTempDatabase(run) {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-session-item-'));
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

function insertExercise(db, { name, metrics = '["sets"]' }) {
  db.run(
    `INSERT INTO training_exercises
      (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, sport_types, enabled, created_at, updated_at)
     VALUES (?, 'mdi:walk', 'strength', 'indoor', 'manual', 'bodyweight', '', ?, 'Test', '[]', 1, ?, ?)`,
    [name, metrics, Date.now(), Date.now()]
  );
  return lastInsertId();
}

function createPlan(body) {
  const response = responseRecorder();
  createTrainingPlan({ body: { name: 'Item plan', ...body } }, response);
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

function preview(query) {
  const response = responseRecorder();
  previewTrainingSessionItemDeletion({ query }, response);
  return response;
}

function batchDelete(body) {
  const response = responseRecorder();
  deleteTrainingSessionItems({ body }, response);
  return response;
}

function countRows(sql, params = []) {
  return Number(databaseService.query(sql, params)[0].values[0][0]);
}

/** 某单元里某个项目的 id；列表展开行用的就是这份数据。 */
function itemIdOf(sessionId, exerciseName) {
  const row = databaseService.query(
    `SELECT item.id AS id FROM training_session_items item
       JOIN training_exercises exercise ON exercise.id = item.exercise_id
       WHERE item.session_id = ? AND exercise.name = ?`,
    [sessionId, exerciseName]
  )[0];
  return row && row.values.length > 0 ? Number(row.values[0][0]) : null;
}

/** 给训练单元留下一条人工打卡记录（用于验证删项目时打卡项目行会级联消失）。 */
function backfill(session) {
  const day = responseRecorder();
  getTrainingExecution({ query: { date: session.scheduledDate } }, day);
  const entry = day.body.sessions.find((item) => item.sessionId === session.id);
  assert.ok(entry, '应能读到刚创建的训练单元');
  const save = responseRecorder();
  saveTrainingSessionExecution(
    {
      params: { id: session.id },
      body: {
        status: 'completed',
        items: entry.items.map((item) => ({ sessionItemId: item.sessionItemId, status: 'done', actuals: { sets: 3 } }))
      }
    },
    save
  );
  assert.equal(save.statusCode, 200, JSON.stringify(save.body));
}

test('lists item ids and check-in state on every session row for the expandable view', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const squat = insertExercise(db, { name: 'Squat' });
    const plank = insertExercise(db, { name: 'Plank' });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 5) });
    const session = createSession(plan.id, {
      scheduledDate: shiftDays(today, -2),
      items: [
        { exerciseId: squat, targets: { sets: 3 } },
        { exerciseId: plank, targets: { sets: 3 } }
      ]
    });
    backfill(session);

    const [row] = sessionList({ planId: String(plan.id) }).sessions;
    assert.equal(row.exercises.length, 2);
    assert.deepEqual(
      row.exercises.map((exercise) => [exercise.name, exercise.position, typeof exercise.id]),
      [
        ['Squat', 0, 'number'],
        ['Plank', 1, 'number']
      ]
    );
    assert.equal(row.exercises[0].logged, true, '打过卡的项目要标出来');
    assert.equal(row.exercises[0].id, itemIdOf(session.id, 'Squat'));
  });
});

test('previews and deletes one exercise across the sessions matching the compound filter', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const squat = insertExercise(db, { name: 'Squat' });
    const plank = insertExercise(db, { name: 'Plank' });
    const plan = createPlan({ startDate: shiftDays(today, -20), endDate: shiftDays(today, 5) });
    const other = createPlan({ name: 'Other', startDate: shiftDays(today, -20), endDate: shiftDays(today, 5) });

    // 计划内三天都配了深蹲；第四天只有平板支撑（不用来验证范围），另外那个计划也有一天深蹲。
    const inScope = [];
    for (const offset of [-6, -5, -4]) {
      inScope.push(
        createSession(plan.id, {
          scheduledDate: shiftDays(today, offset),
          items: [
            { exerciseId: squat, targets: { sets: 3 } },
            { exerciseId: plank, targets: { sets: 3 } }
          ]
        }).id
      );
    }
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -3),
      items: [{ exerciseId: plank, targets: { sets: 3 } }]
    });
    const outOfScope = createSession(other.id, {
      scheduledDate: shiftDays(today, -5),
      items: [{ exerciseId: squat, targets: { sets: 3 } }]
    });
    // 计划外但同计划的一天，用来验证日期区间真的收紧了范围。
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -15),
      items: [{ exerciseId: squat, targets: { sets: 3 } }]
    });

    const filter = { planId: plan.id, startDate: shiftDays(today, -7), endDate: shiftDays(today, -1) };
    const summary = preview({ exerciseId: String(squat), ...filter, page: 1 });
    assert.equal(summary.statusCode, 200, JSON.stringify(summary.body));
    assert.equal(summary.body.exerciseName, 'Squat');
    assert.equal(summary.body.matchedSessionCount, 3);
    assert.equal(summary.body.matchedItemCount, 3);
    assert.equal(summary.body.deletableItemCount, 3);
    assert.equal(summary.body.skippedCount, 0);
    assert.equal(summary.body.executionItemCount, 0);
    assert.equal(summary.body.hasFilter, true);

    // 不带任何单元条件时，预览会看到计划外的那些，但删除必须被挡住。
    assert.equal(preview({ exerciseId: String(squat) }).body.matchedSessionCount, 5);
    const noFilter = batchDelete({ exerciseId: squat, filter: {}, expectedCount: 5 });
    assert.equal(noFilter.statusCode, 400, JSON.stringify(noFilter.body));
    assert.equal(noFilter.body.code, 'SESSION_ITEM_FILTER_REQUIRED');

    // 数量对不上：不执行，也不动数据。
    const mismatch = batchDelete({ exerciseId: squat, filter, expectedCount: 2 });
    assert.equal(mismatch.statusCode, 409, JSON.stringify(mismatch.body));
    assert.equal(mismatch.body.code, 'SESSION_ITEM_DELETE_COUNT_CHANGED');
    assert.deepEqual(mismatch.body.details, { expectedCount: 2, matchedCount: 3, skippedCount: 0 });
    // 3 天 × 2 项 + 1 天只配平板支撑 + 别的计划 1 项 + 计划内区间外 1 项 = 9
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_items'), 9);

    const removed = batchDelete({ exerciseId: squat, filter, expectedCount: 3 });
    assert.equal(removed.statusCode, 200, JSON.stringify(removed.body));
    assert.equal(removed.body.scope, 'exercise');
    assert.equal(removed.body.deletedCount, 3);
    assert.equal(removed.body.affectedSessionCount, 3);
    assert.equal(removed.body.skippedCount, 0);

    // 只有这三天少了深蹲，别的单元和其它项目都不动。
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_items'), 6);
    for (const id of inScope) {
      assert.equal(countRows('SELECT COUNT(*) FROM training_session_items WHERE session_id = ?', [id]), 1);
      assert.equal(
        countRows('SELECT COUNT(*) FROM training_session_items WHERE session_id = ? AND exercise_id = ?', [id, squat]),
        0
      );
    }
    assert.equal(
      countRows('SELECT COUNT(*) FROM training_session_items WHERE session_id = ? AND exercise_id = ?', [
        outOfScope.id,
        squat
      ]),
      1,
      '别的计划不受影响'
    );
    assert.equal(preview({ exerciseId: String(squat), ...filter }).body.deletableItemCount, 0);
  });
});

test('never empties a training session: the last remaining item is skipped and reported', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const squat = insertExercise(db, { name: 'Squat' });
    const plank = insertExercise(db, { name: 'Plank' });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 5) });

    // 一天只有深蹲（唯一项目，必须跳过），一天有深蹲 + 平板支撑（可以删）。
    const onlySquat = createSession(plan.id, {
      scheduledDate: shiftDays(today, -4),
      items: [{ exerciseId: squat, targets: { sets: 3 } }]
    });
    const withBoth = createSession(plan.id, {
      scheduledDate: shiftDays(today, -3),
      items: [
        { exerciseId: squat, targets: { sets: 3 } },
        { exerciseId: plank, targets: { sets: 3 } }
      ]
    });

    const filter = { planId: plan.id };
    const summary = preview({ exerciseId: String(squat), ...filter });
    assert.equal(summary.body.matchedSessionCount, 2);
    assert.equal(summary.body.matchedItemCount, 2);
    assert.equal(summary.body.deletableItemCount, 1, '只剩一个项目的那天不算可删');
    assert.equal(summary.body.skippedCount, 1);

    const removed = batchDelete({ exerciseId: squat, filter, expectedCount: 1 });
    assert.equal(removed.statusCode, 200, JSON.stringify(removed.body));
    assert.equal(removed.body.deletedCount, 1);
    assert.equal(removed.body.skippedCount, 1);
    assert.equal(removed.body.skipReason, 'last_item');
    assert.equal(removed.body.skippedIds.length, 1);

    // 两个单元都还在，谁都没有被删空。
    assert.equal(countRows('SELECT COUNT(*) FROM training_sessions WHERE plan_id = ?', [plan.id]), 2);
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_items WHERE session_id = ?', [onlySquat.id]), 1);
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_items WHERE session_id = ?', [withBoth.id]), 1);

    // 单条删除走同一条规则：删最后一个项目同样被跳过。
    const lastItemId = itemIdOf(onlySquat.id, 'Squat');
    const byId = batchDelete({ ids: [lastItemId] });
    assert.equal(byId.statusCode, 200, JSON.stringify(byId.body));
    assert.equal(byId.body.scope, 'ids');
    assert.equal(byId.body.deletedCount, 0);
    assert.deepEqual(byId.body.skippedIds, [lastItemId]);
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_items WHERE id = ?', [lastItemId]), 1);
  });
});

test('deletes a single item by id and cascades its check-in rows without touching the session log', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const squat = insertExercise(db, { name: 'Squat' });
    const plank = insertExercise(db, { name: 'Plank' });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 5) });
    const session = createSession(plan.id, {
      scheduledDate: shiftDays(today, -2),
      items: [
        { exerciseId: squat, targets: { sets: 3 } },
        { exerciseId: plank, targets: { sets: 3 } }
      ]
    });
    backfill(session);
    const updatedBefore = countRows('SELECT updated_at FROM training_sessions WHERE id = ?', [session.id]);
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_log_items'), 2);

    const squatItemId = itemIdOf(session.id, 'Squat');
    const removed = batchDelete({ ids: [squatItemId, 999999] });
    assert.equal(removed.statusCode, 200, JSON.stringify(removed.body));
    assert.deepEqual(removed.body.deletedIds, [squatItemId]);
    assert.equal(removed.body.deletedCount, 1);
    assert.equal(removed.body.executionCount, 1, '这条项目原本有打卡记录');
    assert.equal(removed.body.affectedSessionCount, 1);

    assert.equal(countRows('SELECT COUNT(*) FROM training_session_items WHERE id = ?', [squatItemId]), 0);
    assert.equal(
      countRows('SELECT COUNT(*) FROM training_session_log_items WHERE session_item_id = ?', [squatItemId]),
      0,
      '打卡项目行随项目一起被外键级联删掉'
    );
    // 单元本身和它的打卡记录都还在，只是少了一个项目。
    assert.equal(countRows('SELECT COUNT(*) FROM training_sessions WHERE id = ?', [session.id]), 1);
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_logs WHERE session_id = ?', [session.id]), 1);
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_log_items'), 1);
    assert.ok(
      countRows('SELECT updated_at FROM training_sessions WHERE id = ?', [session.id]) >= updatedBefore,
      '内容变了要刷新单元的 updated_at'
    );
  });
});

test('refuses malformed item deletion requests without touching data', async () => {
  await withTempDatabase(async (db) => {
    const today = todayDateKey();
    const squat = insertExercise(db, { name: 'Squat' });
    const plank = insertExercise(db, { name: 'Plank' });
    const plan = createPlan({ startDate: shiftDays(today, -10), endDate: shiftDays(today, 5) });
    createSession(plan.id, {
      scheduledDate: shiftDays(today, -2),
      items: [
        { exerciseId: squat, targets: { sets: 3 } },
        { exerciseId: plank, targets: { sets: 3 } }
      ]
    });

    const cases = [
      [{}, 'SESSION_ITEM_DELETE_SCOPE_REQUIRED'],
      [{ ids: [] }, 'SESSION_ITEM_DELETE_SCOPE_REQUIRED'],
      [{ ids: [1], exerciseId: squat }, 'SESSION_ITEM_DELETE_SCOPE_INVALID'],
      [{ ids: ['abc'] }, 'SESSION_ITEM_DELETE_IDS_INVALID'],
      [{ ids: [0] }, 'SESSION_ITEM_DELETE_IDS_INVALID'],
      [{ ids: Array.from({ length: 1001 }, (_, index) => index + 1) }, 'SESSION_ITEM_DELETE_TOO_MANY'],
      [{ exerciseId: 'abc', filter: { planId: plan.id }, expectedCount: 1 }, 'SESSION_ITEM_EXERCISE_REQUIRED'],
      [{ exerciseId: squat, filter: { logged: 'yes' }, expectedCount: 1 }, 'SESSION_FILTER_INVALID'],
      [{ exerciseId: squat, filter: [], expectedCount: 1 }, 'SESSION_FILTER_INVALID'],
      [{ exerciseId: squat, filter: { planId: plan.id } }, 'SESSION_ITEM_DELETE_COUNT_REQUIRED'],
      [{ exerciseId: squat, filter: { planId: plan.id }, expectedCount: '1' }, 'SESSION_ITEM_DELETE_COUNT_REQUIRED'],
      [{ exerciseId: squat, filter: { planId: plan.id }, expectedCount: -1 }, 'SESSION_ITEM_DELETE_COUNT_REQUIRED']
    ];
    for (const [body, code] of cases) {
      const response = batchDelete(body);
      assert.equal(response.statusCode, 400, `${code}: ${JSON.stringify(response.body)}`);
      assert.equal(response.body.code, code, JSON.stringify(body));
    }

    // 预览的入参同样要卡住。
    assert.equal(preview({}).statusCode, 400);
    assert.equal(preview({ exerciseId: 999999 }).statusCode, 404);
    // 项目不存在时删除也是 404（先确认它真的在目录里，再去动数据）。
    const unknownExercise = batchDelete({ exerciseId: 999999, filter: { planId: plan.id }, expectedCount: 1 });
    assert.equal(unknownExercise.statusCode, 404, JSON.stringify(unknownExercise.body));
    assert.equal(unknownExercise.body.code, 'SESSION_ITEM_EXERCISE_NOT_FOUND');
    assert.equal(countRows('SELECT COUNT(*) FROM training_session_items'), 2, '被拒绝的请求不改数据');
  });
});
