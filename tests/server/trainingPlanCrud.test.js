import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../server/src/config/index.js';
import {
  createTrainingPhase,
  createTrainingPlan,
  createTrainingPlanWithSessions,
  createTrainingSession,
  createTrainingSessionsBatch,
  deleteTrainingPlan,
  deleteTrainingPhase,
  deleteTrainingSession,
  getTrainingPlan,
  getTrainingPhaseReview,
  listTrainingPlans,
  listTrainingSessions,
  saveTrainingPhaseReview,
  updateTrainingSession
} from '../../server/src/controllers/trainingPlanController.js';
import { saveTrainingSessionExecution } from '../../server/src/controllers/trainingExecutionController.js';
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

test('creates and reads a plan with phases and dated training sessions', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-training-plan-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const now = Date.now();
    databaseService.getDb().run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ['Walking', 'mdi:walk', 'aerobic', 'outdoor', 'auto', '["duration","distance"]', 'Cardio', now, now]
    );
    const exerciseId = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);

    const planResponse = responseRecorder();
    createTrainingPlan(
      {
        body: {
          name: 'Autumn recovery',
          goal: 'Build consistency',
          startDate: '2026-09-01',
          endDate: '2026-10-31'
        }
      },
      planResponse
    );
    assert.equal(planResponse.statusCode, 201);

    const phaseResponse = responseRecorder();
    createTrainingPhase(
      {
        params: { planId: planResponse.body.id },
        body: {
          name: 'Foundation',
          startDate: '2026-09-01',
          endDate: '2026-09-30'
        }
      },
      phaseResponse
    );
    assert.equal(phaseResponse.statusCode, 201);

    const sessionResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: {
          scheduledDate: '2026-09-17',
          name: 'Easy aerobic day',
          items: [{ exerciseId, targets: { duration: 40, distance: 4 } }]
        }
      },
      sessionResponse
    );
    assert.equal(sessionResponse.statusCode, 201);

    const deletedSessionResponse = responseRecorder();
    deleteTrainingSession({ params: { id: sessionResponse.body.id } }, deletedSessionResponse);
    assert.equal(deletedSessionResponse.statusCode, 204);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_sessions')[0].values[0][0], 0);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_session_items')[0].values[0][0], 0);

    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: {
          scheduledDate: '2026-09-17',
          name: 'Easy aerobic day',
          items: [{ exerciseId, targets: { duration: 40, distance: 4 } }]
        }
      },
      sessionResponse
    );
    assert.equal(sessionResponse.statusCode, 201);

    const detailResponse = responseRecorder();
    getTrainingPlan({ params: { id: planResponse.body.id } }, detailResponse);
    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.body.phases.length, 1);
    assert.equal(detailResponse.body.sessions.length, 1);
    assert.equal(detailResponse.body.sessions[0].planId, planResponse.body.id);
    assert.deepEqual(detailResponse.body.sessions[0].items[0].targets, { duration: 40, distance: 4 });
    assert.equal(detailResponse.body.sessions[0].items[0].verificationMode, 'auto');

    const duplicateResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: { scheduledDate: '2026-09-17', items: [{ exerciseId, targets: { duration: 20 } }] }
      },
      duplicateResponse
    );
    assert.equal(duplicateResponse.statusCode, 409);
    assert.equal(duplicateResponse.body.code, 'SESSION_DATE_EXISTS');

    const deleteResponse = responseRecorder();
    deleteTrainingPhase({ params: { id: phaseResponse.body.id } }, deleteResponse);
    assert.equal(deleteResponse.statusCode, 204);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_sessions')[0].values[0][0], 1);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_session_items')[0].values[0][0], 1);

    const composedResponse = responseRecorder();
    createTrainingPlanWithSessions(
      {
        body: {
          plan: {
            name: 'October recovery',
            startDate: '2026-10-01',
            endDate: '2026-10-31'
          },
          sessions: [
            {
              scheduledDate: '2026-10-03',
              items: [{ exerciseId, targets: { duration: 30 } }]
            },
            {
              scheduledDate: '2026-10-05',
              items: [{ exerciseId, targets: { duration: 45, distance: 5 } }]
            }
          ]
        }
      },
      composedResponse
    );
    assert.equal(composedResponse.statusCode, 201);

    const composedDetailResponse = responseRecorder();
    getTrainingPlan({ params: { id: composedResponse.body.id } }, composedDetailResponse);
    assert.equal(composedDetailResponse.body.sessions.length, 2);
    assert.deepEqual(
      composedDetailResponse.body.sessions.map((session) => session.scheduledDate),
      ['2026-10-03', '2026-10-05']
    );

    const sameDaySessionResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: composedResponse.body.id },
        body: {
          scheduledDate: '2026-10-03',
          sequence: 2,
          items: [{ exerciseId, targets: { duration: 20 } }]
        }
      },
      sameDaySessionResponse
    );
    assert.equal(sameDaySessionResponse.statusCode, 201);

    const pagedSessionsResponse = responseRecorder();
    listTrainingSessions(
      { query: { planId: String(composedResponse.body.id), page: '2', pageSize: '2' } },
      pagedSessionsResponse
    );
    assert.equal(pagedSessionsResponse.statusCode, 200);
    assert.equal(pagedSessionsResponse.body.total, 3);
    assert.equal(pagedSessionsResponse.body.page, 2);
    assert.equal(pagedSessionsResponse.body.pageSize, 2);
    assert.equal(pagedSessionsResponse.body.sessions.length, 1);
    assert.equal(pagedSessionsResponse.body.sessions[0].id, sameDaySessionResponse.body.id);

    const listResponse = responseRecorder();
    listTrainingPlans({}, listResponse);
    const listedComposedPlan = listResponse.body.plans.find((plan) => plan.id === composedResponse.body.id);
    assert.equal(listedComposedPlan.sessionCount, 3);
    assert.equal(listedComposedPlan.trainingDayCount, 2);
    // 没有任何执行记录，达成度只能靠导入数据；这天没数据就是没打卡。
    assert.equal(listedComposedPlan.adherence.fulfilledDays, 0);

    const composedPhaseResponse = responseRecorder();
    createTrainingPhase(
      {
        params: { planId: composedResponse.body.id },
        body: { name: 'Reset', startDate: '2026-10-01', endDate: '2026-10-31' }
      },
      composedPhaseResponse
    );
    assert.equal(composedPhaseResponse.statusCode, 201);

    const listWithPhaseResponse = responseRecorder();
    listTrainingPlans({}, listWithPhaseResponse);
    const listedPlanWithPhase = listWithPhaseResponse.body.plans.find((plan) => plan.id === composedResponse.body.id);
    assert.equal(listedPlanWithPhase.phaseName, 'Reset');

    const deletePlanResponse = responseRecorder();
    deleteTrainingPlan({ params: { id: composedResponse.body.id } }, deletePlanResponse);
    assert.equal(deletePlanResponse.statusCode, 204);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_plans')[0].values[0][0], 1);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_phases')[0].values[0][0], 0);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_sessions')[0].values[0][0], 1);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_session_items')[0].values[0][0], 1);

    const rejectedResponse = responseRecorder();
    createTrainingPlanWithSessions(
      {
        body: {
          plan: { name: 'Invalid composition', startDate: '2026-11-01', endDate: '2026-11-30' },
          sessions: [{ scheduledDate: '2026-12-01', items: [{ exerciseId, targets: { duration: 30 } }] }]
        }
      },
      rejectedResponse
    );
    assert.equal(rejectedResponse.statusCode, 400);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_plans')[0].values[0][0], 1);
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('appends batch exercises to existing training dates', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-training-plan-batch-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const now = Date.now();
    databaseService.getDb().run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ['Walking', 'mdi:walk', 'aerobic', 'outdoor', 'auto', '["duration"]', 'Cardio', now, now]
    );
    const walkingId = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    databaseService.getDb().run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ['Plank', 'mdi:human', 'strength', 'indoor', 'auto', '["duration"]', 'Core', now, now]
    );
    const plankId = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);

    const planResponse = responseRecorder();
    createTrainingPlan(
      {
        body: {
          name: 'Batch append plan',
          startDate: '2026-09-01',
          endDate: '2026-09-30'
        }
      },
      planResponse
    );
    assert.equal(planResponse.statusCode, 201);

    const sessionResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: {
          scheduledDate: '2026-09-10',
          notes: 'Keep the original note',
          status: 'planned',
          items: [{ exerciseId: walkingId, targets: { durationSeconds: 600 } }]
        }
      },
      sessionResponse
    );
    assert.equal(sessionResponse.statusCode, 201);

    const batchResponse = responseRecorder();
    createTrainingSessionsBatch(
      {
        params: { planId: planResponse.body.id },
        body: {
          sessions: [
            { scheduledDate: '2026-09-10', items: [{ exerciseId: plankId, targets: { durationSeconds: 30 } }] },
            { scheduledDate: '2026-09-11', items: [{ exerciseId: plankId, targets: { durationSeconds: 45 } }] }
          ]
        }
      },
      batchResponse
    );
    assert.equal(batchResponse.statusCode, 201);
    assert.equal(batchResponse.body.createdCount, 1);
    assert.equal(batchResponse.body.updatedCount, 1);
    assert.equal(batchResponse.body.itemCount, 2);

    const detailResponse = responseRecorder();
    getTrainingPlan({ params: { id: planResponse.body.id } }, detailResponse);
    assert.equal(detailResponse.body.sessions.length, 2);
    const appendedSession = detailResponse.body.sessions.find((session) => session.scheduledDate === '2026-09-10');
    assert.equal(appendedSession.notes, 'Keep the original note');
    assert.equal(appendedSession.items.length, 2);
    assert.deepEqual(
      appendedSession.items.map((item) => item.exerciseId).sort((a, b) => a - b),
      [walkingId, plankId].sort((a, b) => a - b)
    );
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('overwrites duplicate batch items only when explicitly requested', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-training-plan-overwrite-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const now = Date.now();
    const insertExercise = (name, metrics) => {
      databaseService.getDb().run(
        `INSERT INTO training_exercises
          (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [name, 'mdi:walk', 'aerobic', 'outdoor', 'auto', metrics, 'Cardio', now, now]
      );
      return Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    };
    const walkingId = insertExercise('Walking', '["duration"]');
    const plankId = insertExercise('Plank', '["duration"]');

    const planResponse = responseRecorder();
    createTrainingPlan(
      { body: { name: 'Batch overwrite plan', startDate: '2026-09-01', endDate: '2026-09-30' } },
      planResponse
    );

    databaseService.getDb().run(
      `INSERT INTO training_sessions
        (plan_id, scheduled_date, sequence, name, notes, status, created_at, updated_at)
       VALUES (?, ?, 1, '', 'Keep me', 'planned', ?, ?)`,
      [planResponse.body.id, '2026-09-10', now, now]
    );
    const sessionId = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    databaseService.getDb().run(
      `INSERT INTO training_session_items
        (session_id, exercise_id, position, verification_mode, targets, created_at, updated_at)
       VALUES (?, ?, 0, 'auto', ?, ?, ?)`,
      [sessionId, walkingId, JSON.stringify({ durationSeconds: 600 }), now, now]
    );
    const walkingItemId = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    databaseService.getDb().run(
      `INSERT INTO training_session_logs
        (session_id, status, source, completed_at, created_at, updated_at)
       VALUES (?, 'completed', 'manual', ?, ?, ?)`,
      [sessionId, now, now, now]
    );
    const logId = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    databaseService.getDb().run(
      `INSERT INTO training_session_log_items
        (session_log_id, session_item_id, status, actuals, created_at, updated_at)
       VALUES (?, ?, 'done', ?, ?, ?)`,
      [logId, walkingItemId, JSON.stringify({ durationSeconds: 650 }), now, now]
    );

    const batchResponse = responseRecorder();
    createTrainingSessionsBatch(
      {
        params: { planId: planResponse.body.id },
        body: {
          overwriteExistingItems: true,
          sessions: [
            {
              scheduledDate: '2026-09-10',
              items: [
                { exerciseId: walkingId, targets: { durationSeconds: 900 } },
                { exerciseId: plankId, targets: { durationSeconds: 30 } }
              ]
            },
            { scheduledDate: '2026-09-11', items: [{ exerciseId: plankId, targets: { durationSeconds: 45 } }] }
          ]
        }
      },
      batchResponse
    );
    assert.equal(batchResponse.statusCode, 201);
    assert.equal(batchResponse.body.createdCount, 1);
    assert.equal(batchResponse.body.updatedCount, 1);
    assert.equal(batchResponse.body.itemCount, 2);
    assert.equal(batchResponse.body.overwrittenItemCount, 1);
    const preservedLogItems = databaseService.query(
      'SELECT session_item_id, actuals FROM training_session_log_items WHERE session_log_id = ?',
      [logId]
    )[0].values;
    assert.equal(preservedLogItems.length, 1);
    assert.equal(Number(preservedLogItems[0][0]), walkingItemId);
    assert.deepEqual(JSON.parse(preservedLogItems[0][1]), { durationSeconds: 650 });

    const overwrittenDetail = responseRecorder();
    getTrainingPlan({ params: { id: planResponse.body.id } }, overwrittenDetail);
    const overwrittenSession = overwrittenDetail.body.sessions.find(
      (session) => session.scheduledDate === '2026-09-10'
    );
    assert.equal(overwrittenSession.notes, 'Keep me');
    assert.equal(overwrittenSession.items.length, 2);
    assert.equal(overwrittenSession.items.find((item) => item.exerciseId === walkingId).targets.durationSeconds, 900);

    const skippedResponse = responseRecorder();
    createTrainingSessionsBatch(
      {
        params: { planId: planResponse.body.id },
        body: {
          sessions: [
            { scheduledDate: '2026-09-10', items: [{ exerciseId: walkingId, targets: { durationSeconds: 1200 } }] }
          ]
        }
      },
      skippedResponse
    );
    assert.equal(skippedResponse.statusCode, 201);
    assert.equal(skippedResponse.body.updatedCount, 0);
    assert.equal(skippedResponse.body.itemCount, 0);
    assert.equal(skippedResponse.body.overwrittenItemCount, 0);
    assert.equal(
      Number(
        databaseService.query('SELECT COUNT(*) AS count FROM training_session_log_items WHERE session_log_id = ?', [
          logId
        ])[0].values[0][0]
      ),
      1
    );

    const keptDetail = responseRecorder();
    getTrainingPlan({ params: { id: planResponse.body.id } }, keptDetail);
    const keptSession = keptDetail.body.sessions.find((session) => session.scheduledDate === '2026-09-10');
    assert.equal(keptSession.items.find((item) => item.exerciseId === walkingId).targets.durationSeconds, 900);
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('plan calendar reflects saved mobile training execution', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-training-plan-execution-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const now = Date.now();
    databaseService.getDb().run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        'Pulldown',
        'mdi:dumbbell',
        'strength',
        'indoor',
        'manual',
        'equipment',
        'Pulldown machine',
        '["weight","repetitions","sets"]',
        'Strength',
        now,
        now
      ]
    );
    const exerciseId = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    databaseService.getDb().run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        'Indoor walk',
        'mdi:walk',
        'aerobic',
        'indoor',
        'auto',
        'bodyweight',
        '',
        '["duration","distance"]',
        'Cardio',
        now,
        now
      ]
    );
    const autoExerciseId = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);

    const planResponse = responseRecorder();
    createTrainingPlan(
      {
        body: {
          name: 'Execution plan',
          startDate: '2026-10-01',
          endDate: '2026-10-31'
        }
      },
      planResponse
    );
    assert.equal(planResponse.statusCode, 201);

    const sessionResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: {
          scheduledDate: '2026-10-09',
          items: [
            { exerciseId, targets: { weight: 35, repetitions: 15, sets: 3 } },
            { exerciseId: autoExerciseId, targets: { duration: 35, distance: 3.2 } }
          ]
        }
      },
      sessionResponse
    );
    assert.equal(sessionResponse.statusCode, 201);
    const sessionItemId = Number(
      databaseService.query(
        `SELECT item.id
         FROM training_session_items item
         JOIN training_exercises exercise ON exercise.id = item.exercise_id
         WHERE item.session_id = ? AND exercise.verification_mode = 'manual'`,
        [sessionResponse.body.id]
      )[0].values[0][0]
    );

    const saveResponse = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionResponse.body.id },
        body: {
          status: 'completed',
          items: [
            {
              sessionItemId,
              status: 'done',
              actuals: { weight: 35, repetitions: 15, sets: 3 }
            }
          ]
        }
      },
      saveResponse
    );
    assert.equal(saveResponse.statusCode, 200);

    const listResponse = responseRecorder();
    listTrainingPlans({}, listResponse);
    const listedPlan = listResponse.body.plans.find((plan) => plan.id === planResponse.body.id);
    assert.equal(listedPlan.adherence.fulfilledDays, 1);

    const detailResponse = responseRecorder();
    getTrainingPlan({ params: { id: planResponse.body.id } }, detailResponse);
    assert.equal(detailResponse.statusCode, 200);
    const [session] = detailResponse.body.sessions;
    assert.equal(session.status, 'partial');
    assert.equal(session.execution.status, 'partial');
    assert.deepEqual(session.items[0].execution.actuals, { weight: 35, repetitions: 15, sets: 3 });
    assert.equal(session.items[1].execution, null);
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('saves one phase review and returns its execution summary', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-training-review-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const planResponse = responseRecorder();
    createTrainingPlan(
      {
        body: { name: 'Review plan', startDate: '2026-09-01', endDate: '2026-09-30' }
      },
      planResponse
    );
    const phaseResponse = responseRecorder();
    createTrainingPhase(
      {
        params: { planId: planResponse.body.id },
        body: { name: 'Foundation', startDate: '2026-09-01', endDate: '2026-09-15' }
      },
      phaseResponse
    );

    const firstSessionId = databaseService.getDb().run(
      `INSERT INTO training_sessions
        (plan_id, scheduled_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [planResponse.body.id, '2026-09-03', 'achieved', Date.now(), Date.now()]
    );
    assert.ok(firstSessionId === undefined);
    databaseService.getDb().run(
      `INSERT INTO training_sessions
        (plan_id, scheduled_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [planResponse.body.id, '2026-09-10', 'partial', Date.now(), Date.now()]
    );

    const saveResponse = responseRecorder();
    saveTrainingPhaseReview(
      {
        params: { id: phaseResponse.body.id },
        body: {
          summary: 'Good consistency',
          fatigueLevel: 6,
          discomfort: 'Mild knee tightness',
          weightChange: -0.8,
          adjustment: 'Keep the same volume next phase'
        }
      },
      saveResponse
    );
    assert.equal(saveResponse.statusCode, 200);
    assert.equal(saveResponse.body.review.phaseId, phaseResponse.body.id);
    assert.equal(saveResponse.body.executionSummary.achieved, 1);
    assert.equal(saveResponse.body.executionSummary.partial, 1);

    const updateResponse = responseRecorder();
    saveTrainingPhaseReview(
      { params: { id: phaseResponse.body.id }, body: { summary: 'Updated summary', fatigueLevel: 4 } },
      updateResponse
    );
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateResponse.body.review.summary, 'Updated summary');
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_phase_reviews')[0].values[0][0], 1);

    const invalidResponse = responseRecorder();
    saveTrainingPhaseReview({ params: { id: phaseResponse.body.id }, body: { fatigueLevel: 11 } }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);
    assert.ok(invalidResponse.body.fields.fatigueLevel);

    const getResponse = responseRecorder();
    getTrainingPhaseReview({ params: { id: phaseResponse.body.id } }, getResponse);
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.body.review.summary, 'Updated summary');
    assert.equal(getResponse.body.executionSummary.total, 2);
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('editing a session keeps check-in records of unchanged items', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-training-plan-edit-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const now = Date.now();
    const insertExercise = (name, metrics) => {
      databaseService.getDb().run(
        `INSERT INTO training_exercises
          (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'manual', ?, ?, 1, ?, ?)`,
        [name, 'mdi:dumbbell', 'strength', 'indoor', metrics, 'Strength', now, now]
      );
      return Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    };
    const pressId = insertExercise('Press', '["weight","sets"]');
    const rowId = insertExercise('Row', '["repetitions"]');

    const planResponse = responseRecorder();
    createTrainingPlan(
      { body: { name: 'Edit keeps check-ins', startDate: '2026-09-01', endDate: '2026-09-30' } },
      planResponse
    );
    const sessionResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: {
          scheduledDate: '2026-09-10',
          items: [
            { exerciseId: pressId, targets: { weight: 40, sets: 3 } },
            { exerciseId: rowId, targets: { repetitions: 12 } }
          ]
        }
      },
      sessionResponse
    );
    const sessionId = sessionResponse.body.id;

    const itemRow = () =>
      databaseService.query(
        'SELECT id, exercise_id FROM training_session_items WHERE session_id = ? ORDER BY position, id',
        [sessionId]
      )[0].values;
    const itemIds = Object.fromEntries(itemRow().map(([id, exerciseId]) => [Number(exerciseId), Number(id)]));

    const executionResponse = responseRecorder();
    saveTrainingSessionExecution(
      {
        params: { id: sessionId },
        body: {
          status: 'completed',
          items: [
            { sessionItemId: itemIds[pressId], status: 'done', actuals: { weight: 42.5, sets: 4 } },
            { sessionItemId: itemIds[rowId], status: 'done', actuals: { repetitions: 15 } }
          ]
        }
      },
      executionResponse
    );
    assert.equal(executionResponse.statusCode, 200);

    // 只改目标和备注：项目行 id 与两条打卡记录都必须保留。
    const updateResponse = responseRecorder();
    updateTrainingSession(
      {
        params: { id: sessionId },
        body: {
          scheduledDate: '2026-09-10',
          notes: 'edited notes',
          items: [
            { exerciseId: pressId, targets: { weight: 45, sets: 3 } },
            { exerciseId: rowId, targets: { repetitions: 10 } }
          ]
        }
      },
      updateResponse
    );
    assert.equal(updateResponse.statusCode, 200);
    const updatedItemIds = Object.fromEntries(itemRow().map(([id, exerciseId]) => [Number(exerciseId), Number(id)]));
    assert.equal(updatedItemIds[pressId], itemIds[pressId]);
    assert.equal(updatedItemIds[rowId], itemIds[rowId]);
    assert.equal(
      Number(databaseService.query('SELECT COUNT(*) AS count FROM training_session_log_items')[0].values[0][0]),
      2
    );

    // 移除其中一个项目：只清掉这一条的打卡记录，另一条继续保留。
    const removeResponse = responseRecorder();
    updateTrainingSession(
      {
        params: { id: sessionId },
        body: {
          scheduledDate: '2026-09-10',
          items: [{ exerciseId: pressId, targets: { weight: 45, sets: 3 } }]
        }
      },
      removeResponse
    );
    assert.equal(removeResponse.statusCode, 200);
    const remainingLogItems = databaseService.query(
      `SELECT log_item.session_item_id, log_item.actuals
         FROM training_session_log_items log_item
         JOIN training_session_logs log_head ON log_head.id = log_item.session_log_id
        WHERE log_head.session_id = ?`,
      [sessionId]
    )[0].values;
    assert.equal(remainingLogItems.length, 1);
    assert.equal(Number(remainingLogItems[0][0]), itemIds[pressId]);
    assert.deepEqual(JSON.parse(remainingLogItems[0][1]), { weight: 42.5, sets: 4 });
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
