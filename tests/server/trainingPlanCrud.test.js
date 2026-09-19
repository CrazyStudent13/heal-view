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
  deleteTrainingPlan,
  deleteTrainingPhase,
  deleteTrainingSession,
  getTrainingPlan,
  listTrainingPlans
} from '../../server/src/controllers/trainingPlanController.js';
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
          endDate: '2026-10-31',
          status: 'active'
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
            endDate: '2026-10-31',
            status: 'draft'
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

    const listResponse = responseRecorder();
    listTrainingPlans({}, listResponse);
    const listedComposedPlan = listResponse.body.plans.find((plan) => plan.id === composedResponse.body.id);
    assert.equal(listedComposedPlan.sessionCount, 3);
    assert.equal(listedComposedPlan.trainingDayCount, 2);
    assert.equal(listedComposedPlan.completedTrainingDayCount, 0);

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
