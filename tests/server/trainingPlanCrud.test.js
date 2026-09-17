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
  deleteTrainingPhase,
  getTrainingPlan
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
        params: { phaseId: phaseResponse.body.id },
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
    assert.equal(detailResponse.body.phases[0].sessions.length, 1);
    assert.deepEqual(detailResponse.body.phases[0].sessions[0].items[0].targets, { duration: 40, distance: 4 });
    assert.equal(detailResponse.body.phases[0].sessions[0].items[0].verificationMode, 'auto');

    const duplicateResponse = responseRecorder();
    createTrainingSession(
      {
        params: { phaseId: phaseResponse.body.id },
        body: { scheduledDate: '2026-09-17', items: [{ exerciseId, targets: { duration: 20 } }] }
      },
      duplicateResponse
    );
    assert.equal(duplicateResponse.statusCode, 409);
    assert.equal(duplicateResponse.body.code, 'SESSION_DATE_EXISTS');

    const deleteResponse = responseRecorder();
    deleteTrainingPhase({ params: { id: phaseResponse.body.id } }, deleteResponse);
    assert.equal(deleteResponse.statusCode, 204);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_sessions')[0].values[0][0], 0);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_session_items')[0].values[0][0], 0);
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
