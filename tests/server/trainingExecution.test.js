import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../server/src/config/index.js';
import { createTrainingPlan, createTrainingSession } from '../../server/src/controllers/trainingPlanController.js';
import {
  getTrainingExecution,
  getTrainingExecutionHistory,
  getTrainingSessionExecution,
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

async function withTemporaryDatabase(run) {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-training-execution-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    await run();
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function queryFirst(sql, params = []) {
  const rows = databaseService.query(sql, params);
  if (rows.length === 0) return null;
  return Object.fromEntries(rows[0].columns.map((column, index) => [column, rows[0].values[0][index]]));
}

function insertExercise({ name, category, verificationMode, metrics }) {
  const now = Date.now();
  databaseService.getDb().run(
    `INSERT INTO training_exercises
      (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, enabled, created_at, updated_at)
     VALUES (?, 'mdi:dumbbell', ?, 'indoor', ?, 'equipment', ?, ?, 'test', 1, ?, ?)`,
    [name, category, verificationMode, name, JSON.stringify(metrics), now, now]
  );
  return Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}

function createSessionFixture({ startDate = '2026-09-01', endDate = '2026-09-30', scheduledDate, items }) {
  const planResponse = responseRecorder();
  createTrainingPlan({ body: { name: 'Strength block', startDate, endDate, status: 'active' } }, planResponse);
  assert.equal(planResponse.statusCode, 201);

  const sessionResponse = responseRecorder();
  createTrainingSession({ params: { planId: planResponse.body.id }, body: { scheduledDate, items } }, sessionResponse);
  assert.equal(sessionResponse.statusCode, 201);
  return { planId: planResponse.body.id, sessionId: sessionResponse.body.id };
}

test('saves, reloads, and idempotently updates a manual training execution', async () => {
  await withTemporaryDatabase(async () => {
    const pressId = insertExercise({
      name: 'Shoulder press',
      category: 'strength',
      verificationMode: 'manual',
      metrics: ['weight', 'sets']
    });
    const { sessionId } = createSessionFixture({
      scheduledDate: '2026-09-10',
      items: [{ exerciseId: pressId, targets: { weight: 40, sets: 3 } }]
    });

    const dayResponse = responseRecorder();
    getTrainingExecution({ query: { date: '2026-09-10' } }, dayResponse);
    assert.equal(dayResponse.statusCode, 200);
    assert.equal(dayResponse.body.sessions.length, 1);
    const [plannedSession] = dayResponse.body.sessions;
    assert.equal(plannedSession.itemCount, 1);
    assert.equal(plannedSession.doneCount, 0);
    assert.equal(plannedSession.execution, null);
    assert.deepEqual(plannedSession.items[0].targets, { weight: 40, sets: 3 });
    assert.equal(plannedSession.items[0].verificationMode, 'manual');
    assert.equal(plannedSession.items[0].execution, null);
    assert.equal(plannedSession.items[0].lastActuals, null);

    const sessionItemId = plannedSession.items[0].sessionItemId;

    const saveResponse = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionId },
        body: {
          status: 'completed',
          sessionFeel: 'normal',
          note: 'Felt steady',
          items: [{ sessionItemId, status: 'done', actuals: { weight: 42.5, sets: 4 } }]
        }
      },
      saveResponse
    );
    assert.equal(saveResponse.statusCode, 200);
    assert.equal(saveResponse.body.execution.status, 'completed');
    assert.equal(saveResponse.body.execution.source, 'manual');
    assert.equal(saveResponse.body.execution.sessionFeel, 'normal');
    assert.deepEqual(saveResponse.body.execution.items[0].actuals, { weight: 42.5, sets: 4 });
    assert.ok(saveResponse.body.execution.completedAt > 0);
    const comparisons = Object.fromEntries(
      saveResponse.body.execution.items[0].comparisons.map((entry) => [entry.metric, entry])
    );
    assert.equal(comparisons.weight.ratio, 1.06);
    assert.equal(comparisons.sets.ratio, 1.33);

    const reloadResponse = responseRecorder();
    getTrainingSessionExecution({ params: { id: sessionId } }, reloadResponse);
    assert.equal(reloadResponse.statusCode, 200);
    assert.equal(reloadResponse.body.session.doneCount, 1);
    assert.equal(reloadResponse.body.session.items[0].execution.status, 'done');
    assert.deepEqual(reloadResponse.body.execution.items[0].actuals, { weight: 42.5, sets: 4 });

    // 幂等：重复提交同一训练单元只更新一条记录，不产生重复行。
    const secondSave = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionId },
        body: {
          status: 'completed',
          sessionFeel: 'hard',
          items: [{ sessionItemId, status: 'done', actuals: { weight: 45, sets: 5 } }]
        }
      },
      secondSave
    );
    assert.equal(secondSave.statusCode, 200);
    assert.equal(secondSave.body.execution.id, saveResponse.body.execution.id);
    assert.deepEqual(secondSave.body.execution.items[0].actuals, { weight: 45, sets: 5 });
    assert.equal(
      Number(databaseService.query('SELECT COUNT(*) AS count FROM training_session_logs')[0].values[0][0]),
      1
    );
    assert.equal(
      Number(databaseService.query('SELECT COUNT(*) AS count FROM training_session_log_items')[0].values[0][0]),
      1
    );

    // 越界：不属于该训练单元的项目必须被拒绝。
    const foreignResponse = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionId },
        body: { items: [{ sessionItemId: sessionItemId + 999, status: 'done', actuals: { weight: 40 } }] }
      },
      foreignResponse
    );
    assert.equal(foreignResponse.statusCode, 400);
    assert.ok(foreignResponse.body.fields['items.0.sessionItemId']);
  });
});

test('rejects invalid execution payloads and unknown sessions', async () => {
  await withTemporaryDatabase(async () => {
    const pressId = insertExercise({
      name: 'Lat pulldown',
      category: 'strength',
      verificationMode: 'manual',
      metrics: ['weight', 'sets']
    });
    const { sessionId } = createSessionFixture({
      scheduledDate: '2026-09-12',
      items: [{ exerciseId: pressId, targets: { weight: 50, sets: 3 } }]
    });

    const dayResponse = responseRecorder();
    getTrainingExecution({ query: { date: '2026-09-12' } }, dayResponse);
    const sessionItemId = dayResponse.body.sessions[0].items[0].sessionItemId;

    const missingItems = responseRecorder();
    saveTrainingSessionExecution({ params: { id: sessionId }, body: { status: 'completed' } }, missingItems);
    assert.equal(missingItems.statusCode, 400);
    assert.ok(missingItems.body.fields.items);

    const emptyActuals = responseRecorder();
    saveTrainingSessionExecution(
      { params: { id: sessionId }, body: { items: [{ sessionItemId, status: 'done', actuals: {} }] } },
      emptyActuals
    );
    assert.equal(emptyActuals.statusCode, 400);
    assert.ok(emptyActuals.body.fields['items.0.actuals']);

    // 未支持的指标必须被拒绝：该运动项目只支持 weight / sets。
    const unsupportedMetric = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionId },
        body: { items: [{ sessionItemId, status: 'done', actuals: { distance: 5 } }] }
      },
      unsupportedMetric
    );
    assert.equal(unsupportedMetric.statusCode, 400);
    assert.ok(unsupportedMetric.body.fields['items.0.actuals']);

    const skipWithoutReason = responseRecorder();
    saveTrainingSessionExecution(
      { params: { id: sessionId }, body: { status: 'skipped', items: [{ sessionItemId, status: 'skipped' }] } },
      skipWithoutReason
    );
    assert.equal(skipWithoutReason.statusCode, 400);
    assert.ok(skipWithoutReason.body.fields['items.0.skipReason']);

    // 全部项目都跳过时，训练单元本身必须标记为 skipped。
    const wrongSessionStatus = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionId },
        body: {
          status: 'completed',
          items: [{ sessionItemId, status: 'skipped', skipReason: 'equipment_busy' }]
        }
      },
      wrongSessionStatus
    );
    assert.equal(wrongSessionStatus.statusCode, 400);
    assert.ok(wrongSessionStatus.body.fields.status);

    // partial 表示「做了但没达到目标」，全部项目 done 也必须被接受。
    const partialResponse = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionId },
        body: {
          status: 'partial',
          items: [{ sessionItemId, status: 'done', actuals: { weight: 20, sets: 1 } }]
        }
      },
      partialResponse
    );
    assert.equal(partialResponse.statusCode, 200);
    assert.equal(partialResponse.body.execution.status, 'partial');

    const skippedSession = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionId },
        body: {
          status: 'skipped',
          sessionFeel: 'easy',
          items: [{ sessionItemId, status: 'skipped', skipReason: 'equipment_busy' }]
        }
      },
      skippedSession
    );
    assert.equal(skippedSession.statusCode, 200);
    assert.equal(skippedSession.body.execution.status, 'skipped');
    assert.equal(skippedSession.body.execution.items[0].skipReason, 'equipment_busy');

    const unknownSession = responseRecorder();
    saveTrainingSessionExecution({ params: { id: 987654 }, body: { items: [] } }, unknownSession);
    assert.equal(unknownSession.statusCode, 404);

    const invalidDate = responseRecorder();
    getTrainingExecution({ query: { date: '2026-9-1' } }, invalidDate);
    assert.equal(invalidDate.statusCode, 400);

    const excessiveRange = responseRecorder();
    getTrainingExecutionHistory({ query: { startDate: '2026-01-01', endDate: '2026-12-31' } }, excessiveRange);
    assert.equal(excessiveRange.statusCode, 400);
  });
});

test('returns the most recent previous actuals instead of the oldest', async () => {
  await withTemporaryDatabase(async () => {
    const pressId = insertExercise({
      name: 'Chest press',
      category: 'strength',
      verificationMode: 'manual',
      metrics: ['weight', 'sets']
    });

    const planResponse = responseRecorder();
    createTrainingPlan(
      { body: { name: 'Progression block', startDate: '2026-09-01', endDate: '2026-09-30', status: 'active' } },
      planResponse
    );
    const planId = planResponse.body.id;

    // 连续三次同项目训练，重量逐次递增，用来验证只取最近一次而不是最早一次。
    const sessionIds = [];
    for (const [scheduledDate, weight] of [
      ['2026-09-01', 30],
      ['2026-09-03', 35],
      ['2026-09-05', 40]
    ]) {
      const created = responseRecorder();
      createTrainingSession(
        {
          params: { planId },
          body: { scheduledDate, items: [{ exerciseId: pressId, targets: { weight, sets: 3 } }] }
        },
        created
      );
      assert.equal(created.statusCode, 201);
      sessionIds.push({ id: created.body.id, scheduledDate, weight });
    }

    for (const session of sessionIds.slice(0, 2)) {
      const day = responseRecorder();
      getTrainingExecution({ query: { date: session.scheduledDate } }, day);
      const sessionItemId = day.body.sessions[0].items[0].sessionItemId;
      const saved = responseRecorder();
      saveTrainingSessionExecution(
        {
          params: { id: session.id },
          body: {
            status: 'completed',
            items: [{ sessionItemId, status: 'done', actuals: { weight: session.weight, sets: 3 } }]
          }
        },
        saved
      );
      assert.equal(saved.statusCode, 200);
    }

    const latestDay = responseRecorder();
    getTrainingExecution({ query: { date: '2026-09-05' } }, latestDay);
    const item = latestDay.body.sessions[0].items[0];
    assert.deepEqual(item.lastActuals, { weight: 35, sets: 3 });
    assert.equal(item.lastPerformedAt, '2026-09-03');
  });
});

test('exposes only manual items and keeps automatic ones out of the check-in flow', async () => {
  await withTemporaryDatabase(async () => {
    const pressId = insertExercise({
      name: 'Leg extension',
      category: 'strength',
      verificationMode: 'manual',
      metrics: ['weight', 'sets']
    });
    const bikeId = insertExercise({
      name: 'Rowing machine',
      category: 'aerobic',
      verificationMode: 'auto',
      metrics: ['duration']
    });

    const planResponse = responseRecorder();
    createTrainingPlan(
      { body: { name: 'Mixed block', startDate: '2026-09-01', endDate: '2026-09-30', status: 'active' } },
      planResponse
    );
    const planId = planResponse.body.id;

    const firstSession = responseRecorder();
    createTrainingSession(
      {
        params: { planId },
        body: {
          scheduledDate: '2026-09-08',
          items: [
            { exerciseId: pressId, targets: { weight: 30, sets: 3 } },
            { exerciseId: bikeId, targets: { duration: 20 } }
          ]
        }
      },
      firstSession
    );
    assert.equal(firstSession.statusCode, 201);

    const secondSession = responseRecorder();
    createTrainingSession(
      {
        params: { planId },
        body: {
          scheduledDate: '2026-09-15',
          items: [
            { exerciseId: pressId, targets: { weight: 32.5, sets: 3 } },
            { exerciseId: bikeId, targets: { duration: 25 } }
          ]
        }
      },
      secondSession
    );
    assert.equal(secondSession.statusCode, 201);

    // 无氧项目不出现在确认流程里，但数量要单独返回，供前端提示「其余由手表自动确认」。
    const firstDay = responseRecorder();
    getTrainingExecution({ query: { date: '2026-09-08' } }, firstDay);
    const mixedSession = firstDay.body.sessions[0];
    assert.equal(mixedSession.itemCount, 1);
    assert.equal(mixedSession.autoItemCount, 1);
    assert.deepEqual(
      mixedSession.items.map((item) => item.exercise.name),
      ['Leg extension']
    );
    const pressItem = mixedSession.items[0];

    // 自动验证项目既不出现在 items 里，也不允许被提交。
    const autoRow = queryFirst(
      `SELECT item.id FROM training_session_items item
       JOIN training_exercises exercise ON exercise.id = item.exercise_id
       WHERE item.session_id = ? AND exercise.verification_mode = 'auto'`,
      [secondSession.body.id]
    );
    const autoSubmit = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: secondSession.body.id },
        body: { status: 'completed', items: [{ sessionItemId: autoRow.id, status: 'done', actuals: { duration: 20 } }] }
      },
      autoSubmit
    );
    assert.equal(autoSubmit.statusCode, 400);
    assert.ok(autoSubmit.body.fields['items.0.sessionItemId']);

    const firstSave = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: firstSession.body.id },
        body: {
          status: 'completed',
          sessionFeel: 'easy',
          items: [{ sessionItemId: pressItem.sessionItemId, status: 'done', actuals: { weight: 35, sets: 3 } }]
        }
      },
      firstSave
    );
    assert.equal(firstSave.statusCode, 200);
    assert.equal(firstSave.body.execution.source, 'manual');
    // 只手动项目会落库：这个训练单元有两个项目，但只应写入一条手动记录。
    assert.equal(
      Number(
        databaseService.query(
          `SELECT COUNT(*) AS count FROM training_session_log_items item
           JOIN training_session_logs log ON log.id = item.session_log_id
           WHERE log.session_id = ?`,
          [firstSession.body.id]
        )[0].values[0][0]
      ),
      1
    );

    // 第二次训练时，移动端要能拿到上一次的实际重量用于预填。
    const secondDay = responseRecorder();
    getTrainingExecution({ query: { date: '2026-09-15' } }, secondDay);
    const nextPressItem = secondDay.body.sessions[0].items[0];
    assert.deepEqual(nextPressItem.lastActuals, { weight: 35, sets: 3 });
    assert.equal(nextPressItem.lastPerformedAt, '2026-09-08');

    const historyResponse = responseRecorder();
    getTrainingExecutionHistory({ query: { startDate: '2026-09-01', endDate: '2026-09-30' } }, historyResponse);
    assert.equal(historyResponse.statusCode, 200);
    assert.equal(historyResponse.body.sessions.length, 1);
    assert.equal(historyResponse.body.sessions[0].scheduledDate, '2026-09-08');

    // 删除训练单元时执行记录必须级联清理，避免留下孤儿记录。
    const deleteResponse = responseRecorder();
    const { deleteTrainingSession } = await import('../../server/src/controllers/trainingPlanController.js');
    deleteTrainingSession({ params: { id: firstSession.body.id } }, deleteResponse);
    assert.equal(deleteResponse.statusCode, 204);
    assert.equal(
      Number(databaseService.query('SELECT COUNT(*) AS count FROM training_session_logs')[0].values[0][0]),
      0
    );
    assert.equal(
      Number(databaseService.query('SELECT COUNT(*) AS count FROM training_session_log_items')[0].values[0][0]),
      0
    );
  });
});

test('reports a session whose items are all automatic without asking for confirmation', async () => {
  await withTemporaryDatabase(async () => {
    const walkId = insertExercise({
      name: 'Indoor walking',
      category: 'aerobic',
      verificationMode: 'auto',
      metrics: ['duration', 'distance']
    });
    const { sessionId } = createSessionFixture({
      scheduledDate: '2026-09-20',
      items: [{ exerciseId: walkId, targets: { duration: 40, distance: 4 } }]
    });

    const day = responseRecorder();
    getTrainingExecution({ query: { date: '2026-09-20' } }, day);
    assert.equal(day.statusCode, 200);
    const session = day.body.sessions[0];
    // 训练单元仍然要出现（让你知道这天有安排），但没有待确认项目。
    assert.equal(session.itemCount, 0);
    assert.equal(session.autoItemCount, 1);
    assert.equal(session.items.length, 0);
    assert.equal(session.execution, null);

    const save = responseRecorder();
    saveTrainingSessionExecution({ params: { id: sessionId }, body: { status: 'completed', items: [] } }, save);
    assert.equal(save.statusCode, 409);
    assert.equal(save.body.code, 'SESSION_HAS_NO_MANUAL_ITEMS');
  });
});
