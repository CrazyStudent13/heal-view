import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../server/src/config/index.js';
import {
  deleteTrainingExercise,
  deleteTrainingExercises,
  updateTrainingExercisesEnabled
} from '../../server/src/controllers/trainingExerciseController.js';
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

test('deletes only unreferenced training exercises', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-exercise-delete-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const db = databaseService.getDb();
    const now = Date.now();
    db.run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      ['Cycling', 'mdi:bike', 'aerobic', 'outdoor', 'auto', '[]', 'Cardio', now, now]
    );
    const id = Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    db.run(`CREATE TABLE training_plan_items (
      id INTEGER PRIMARY KEY,
      exercise_id INTEGER NOT NULL REFERENCES training_exercises(id)
    )`);
    db.run('INSERT INTO training_plan_items (id, exercise_id) VALUES (?, ?)', [1, id]);

    const blockedResponse = responseRecorder();
    deleteTrainingExercise({ params: { id } }, blockedResponse);
    assert.equal(blockedResponse.statusCode, 409);
    assert.equal(blockedResponse.body.code, 'TRAINING_EXERCISE_IN_USE');
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_exercises')[0].values[0][0], 1);

    db.run('DELETE FROM training_plan_items WHERE exercise_id = ?', [id]);
    const deletedResponse = responseRecorder();
    deleteTrainingExercise({ params: { id } }, deletedResponse);
    assert.equal(deletedResponse.statusCode, 204);
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_exercises')[0].values[0][0], 0);

    for (const name of ['Running', 'Walking']) {
      db.run(
        `INSERT INTO training_exercises
          (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [name, 'mdi:run', 'aerobic', 'outdoor', 'auto', '[]', 'Cardio', now, now]
      );
    }
    const batchIds = databaseService
      .query('SELECT id FROM training_exercises ORDER BY id')[0]
      .values.map(([exerciseId]) => Number(exerciseId));

    const disabledResponse = responseRecorder();
    updateTrainingExercisesEnabled({ body: { ids: batchIds, enabled: false } }, disabledResponse);
    assert.equal(disabledResponse.statusCode, 200);
    assert.deepEqual(
      disabledResponse.body.updatedIds.sort((a, b) => a - b),
      batchIds
    );
    assert.deepEqual(databaseService.query('SELECT enabled FROM training_exercises ORDER BY id')[0].values, [[0], [0]]);

    const enabledResponse = responseRecorder();
    updateTrainingExercisesEnabled({ body: { ids: batchIds, enabled: true } }, enabledResponse);
    assert.equal(enabledResponse.statusCode, 200);
    assert.deepEqual(
      enabledResponse.body.updatedIds.sort((a, b) => a - b),
      batchIds
    );
    assert.deepEqual(databaseService.query('SELECT enabled FROM training_exercises ORDER BY id')[0].values, [[1], [1]]);

    db.run('INSERT INTO training_plan_items (id, exercise_id) VALUES (?, ?)', [2, batchIds[0]]);
    const blockedBatchResponse = responseRecorder();
    deleteTrainingExercises({ body: { ids: batchIds } }, blockedBatchResponse);
    assert.equal(blockedBatchResponse.statusCode, 409);
    assert.equal(blockedBatchResponse.body.code, 'TRAINING_EXERCISE_IN_USE');
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_exercises')[0].values[0][0], 2);

    db.run('DELETE FROM training_plan_items WHERE exercise_id = ?', [batchIds[0]]);
    const deletedBatchResponse = responseRecorder();
    deleteTrainingExercises({ body: { ids: batchIds } }, deletedBatchResponse);
    assert.equal(deletedBatchResponse.statusCode, 200);
    assert.deepEqual(
      deletedBatchResponse.body.deletedIds.sort((a, b) => a - b),
      batchIds
    );
    assert.equal(databaseService.query('SELECT COUNT(*) AS count FROM training_exercises')[0].values[0][0], 0);
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
