import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../server/src/config/index.js';
import {
  defaultTrainingExercises,
  legacyTrainingExerciseNames
} from '../../server/src/data/defaultTrainingExercises.js';
import { trainingExerciseValidation } from '../../server/src/controllers/trainingExerciseController.js';
import { databaseService } from '../../server/src/services/database.js';
import { seedTrainingExercises } from '../../server/src/services/trainingExerciseSeed.js';

test('defines a valid and unique default training exercise catalog', () => {
  assert.equal(defaultTrainingExercises.length, 16);
  assert.equal(new Set(defaultTrainingExercises.map((exercise) => exercise.name)).size, 16);

  for (const exercise of defaultTrainingExercises) {
    const result = trainingExerciseValidation.validatePayload(exercise);
    assert.equal(result.errors, undefined, `${exercise.name} should be valid`);
  }
});

test('uses the requested metrics for each default training exercise', () => {
  const metricsByName = Object.fromEntries(
    defaultTrainingExercises.map((exercise) => [exercise.name, exercise.metrics])
  );

  assert.deepEqual(metricsByName, {
    骑行: ['distance'],
    跑步: ['duration', 'distance'],
    室内步行: ['duration', 'distance'],
    椭圆机: ['duration', 'resistance'],
    划船机: ['duration'],
    '肩膊推举器（正手）': ['weight', 'repetitions', 'sets'],
    '肩膊推举器（反手）': ['weight', 'repetitions', 'sets'],
    '蝶式拉背器（正拉）': ['weight', 'repetitions', 'sets'],
    '蝶式拉背器（反拉）': ['weight', 'repetitions', 'sets'],
    '高拉背器（正手）': ['weight', 'repetitions', 'sets'],
    '高拉背器（反手）': ['weight', 'repetitions', 'sets'],
    '大腿内外侧肌训练器（内收）': ['weight', 'repetitions', 'sets'],
    '大腿内外侧肌训练器（外展）': ['weight', 'repetitions', 'sets'],
    平板支撑: ['sets', 'duration'],
    俯卧撑: ['sets', 'repetitions'],
    仰卧起坐: ['sets', 'repetitions']
  });
});

test('classifies default exercises by their equipment requirements', () => {
  const equipmentByName = Object.fromEntries(
    defaultTrainingExercises.map((exercise) => [
      exercise.name,
      {
        mode: exercise.equipmentMode,
        equipment: exercise.equipment
      }
    ])
  );

  assert.deepEqual(equipmentByName, {
    骑行: { mode: 'equipment', equipment: '自行车' },
    跑步: { mode: 'bodyweight', equipment: '' },
    室内步行: { mode: 'equipment', equipment: '跑步机' },
    椭圆机: { mode: 'equipment', equipment: '椭圆机' },
    划船机: { mode: 'equipment', equipment: '划船机' },
    '肩膊推举器（正手）': { mode: 'equipment', equipment: '肩膊推举器' },
    '肩膊推举器（反手）': { mode: 'equipment', equipment: '肩膊推举器' },
    '蝶式拉背器（正拉）': { mode: 'equipment', equipment: '蝶式拉背器' },
    '蝶式拉背器（反拉）': { mode: 'equipment', equipment: '蝶式拉背器' },
    '高拉背器（正手）': { mode: 'equipment', equipment: '高拉背器' },
    '高拉背器（反手）': { mode: 'equipment', equipment: '高拉背器' },
    '大腿内外侧肌训练器（内收）': { mode: 'equipment', equipment: '大腿内外侧肌训练器' },
    '大腿内外侧肌训练器（外展）': { mode: 'equipment', equipment: '大腿内外侧肌训练器' },
    平板支撑: { mode: 'bodyweight', equipment: '' },
    俯卧撑: { mode: 'bodyweight', equipment: '' },
    仰卧起坐: { mode: 'bodyweight', equipment: '' }
  });
});

// 拆分前每个器械只有一行，握法/方向的分组靠名字前缀识别。
test('splits each variant machine into grip or direction specific exercises', () => {
  const variantsByMachine = new Map();
  for (const exercise of defaultTrainingExercises) {
    if (exercise.equipmentMode !== 'equipment' || exercise.category !== 'strength') continue;
    const variants = variantsByMachine.get(exercise.equipment) || [];
    variants.push(exercise.name);
    variantsByMachine.set(exercise.equipment, variants);
  }

  assert.deepEqual(Object.fromEntries(variantsByMachine), {
    肩膊推举器: ['肩膊推举器（正手）', '肩膊推举器（反手）'],
    蝶式拉背器: ['蝶式拉背器（正拉）', '蝶式拉背器（反拉）'],
    高拉背器: ['高拉背器（正手）', '高拉背器（反手）'],
    大腿内外侧肌训练器: ['大腿内外侧肌训练器（内收）', '大腿内外侧肌训练器（外展）']
  });

  // 旧目录里的“纯器械名”不应该再作为项目出现。
  const names = new Set(defaultTrainingExercises.map((exercise) => exercise.name));
  for (const legacyName of Object.keys(legacyTrainingExerciseNames)) {
    assert.equal(names.has(legacyName), false, `${legacyName} should be split into variants`);
  }
});

function queryNames() {
  const rows = databaseService.query('SELECT id, name, enabled FROM training_exercises ORDER BY id');
  if (rows.length === 0) return [];
  return rows[0].values.map(([id, name, enabled]) => ({ id: Number(id), name, enabled: Number(enabled) }));
}

function withTemporaryDatabase(run) {
  return async () => {
    const originalDbPath = config.dbPath;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-exercise-seed-'));
    config.dbPath = path.join(directory, 'health_data.db');

    try {
      await databaseService.initialize();
      await run();
    } finally {
      databaseService.close();
      config.dbPath = originalDbPath;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  };
}

test(
  'seeds the full split catalog and stays idempotent',
  withTemporaryDatabase(async () => {
    const first = seedTrainingExercises();
    assert.deepEqual(
      { created: first.created, updated: first.updated, renamed: first.renamed, total: first.total },
      { created: 16, updated: 0, renamed: 0, total: 16 }
    );
    assert.equal(
      queryNames().every((exercise) => exercise.enabled === 1),
      true
    );

    const second = seedTrainingExercises();
    assert.deepEqual(
      { created: second.created, updated: second.updated, renamed: second.renamed, total: second.total },
      { created: 0, updated: 16, renamed: 0, total: 16 }
    );
    assert.equal(queryNames().length, 16);
  })
);

test(
  'renames legacy equipment rows in place so existing plans keep their exercise',
  withTemporaryDatabase(async () => {
    const db = databaseService.getDb();
    const now = Date.now();
    const legacyNames = Object.keys(legacyTrainingExerciseNames);
    for (const name of legacyNames) {
      db.run(
        `INSERT INTO training_exercises
          (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, enabled, created_at, updated_at)
         VALUES (?, 'mdi:dumbbell', 'strength', 'indoor', 'manual', 'equipment', ?, '["weight"]', '', 1, ?, ?)`,
        [name, name, now, now]
      );
    }

    // 既有计划和执行记录都是按 exercise_id 引用的，这里放一张表来证明引用没有断链。
    db.run(`CREATE TABLE legacy_session_items (
      id INTEGER PRIMARY KEY,
      exercise_id INTEGER NOT NULL REFERENCES training_exercises(id)
    )`);
    const legacyIds = new Map(queryNames().map((exercise) => [exercise.name, exercise.id]));
    for (const [index, exerciseId] of [...legacyIds.values()].entries()) {
      db.run('INSERT INTO legacy_session_items (id, exercise_id) VALUES (?, ?)', [index + 1, exerciseId]);
    }

    const result = seedTrainingExercises();
    assert.equal(result.renamed, 4);
    assert.equal(result.retired, 0);
    assert.equal(result.created, 12);
    assert.equal(result.total, 16);

    const after = new Map(queryNames().map((exercise) => [exercise.name, exercise]));
    for (const [legacyName, replacementName] of Object.entries(legacyTrainingExerciseNames)) {
      // 旧 id 直接变成变体，历史计划指向的项目仍在，且不再是“纯器械”名字。
      assert.equal(after.get(legacyName), undefined);
      assert.equal(after.get(replacementName).id, legacyIds.get(legacyName));
      assert.equal(after.get(replacementName).enabled, 1);
    }
    assert.equal(queryNames().length, 16);
    assert.equal(
      databaseService.query('SELECT COUNT(*) AS count FROM legacy_session_items')[0].values[0][0],
      legacyNames.length
    );

    const second = seedTrainingExercises();
    assert.deepEqual(
      { created: second.created, updated: second.updated, renamed: second.renamed },
      { created: 0, updated: 16, renamed: 0 }
    );
    assert.equal(queryNames().length, 16);
  })
);

test(
  'keeps history on the legacy row when the replacement name already exists',
  withTemporaryDatabase(async () => {
    const db = databaseService.getDb();
    const now = Date.now();
    const insert = (name) =>
      db.run(
        `INSERT INTO training_exercises
          (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, enabled, created_at, updated_at)
         VALUES (?, 'mdi:dumbbell', 'strength', 'indoor', 'manual', 'equipment', '高拉背器', '["weight"]', '', 1, ?, ?)`,
        [name, now, now]
      );
    insert('高拉背器');
    insert('高拉背器（正手）');

    const result = seedTrainingExercises();
    assert.equal(result.renamed, 0);
    assert.equal(result.retired, 1);

    const rows = queryNames();
    const legacyRow = rows.find((exercise) => exercise.name === '高拉背器');
    const overhandRow = rows.find((exercise) => exercise.name === '高拉背器（正手）');
    // 同名两行会让人没法选，所以旧行停用；但它保留下来，历史引用依旧有效。
    assert.equal(legacyRow.enabled, 0);
    assert.notEqual(legacyRow.id, overhandRow.id);
    assert.equal(overhandRow.enabled, 1);
    assert.equal(rows.filter((exercise) => exercise.name === '高拉背器（反手）').length, 1);
  })
);
