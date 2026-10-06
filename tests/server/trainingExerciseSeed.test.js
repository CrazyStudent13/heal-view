import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTrainingExercises } from '../../server/src/data/defaultTrainingExercises.js';
import { trainingExerciseValidation } from '../../server/src/controllers/trainingExerciseController.js';

test('defines a valid and unique default training exercise catalog', () => {
  assert.equal(defaultTrainingExercises.length, 12);
  assert.equal(new Set(defaultTrainingExercises.map((exercise) => exercise.name)).size, 12);

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
    肩膊推举器: ['weight', 'sets'],
    蝶式拉背器: ['weight', 'sets'],
    高拉背器: ['weight', 'sets'],
    大腿内外侧肌训练器: ['weight', 'sets'],
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
    肩膊推举器: { mode: 'equipment', equipment: '肩膊推举器' },
    蝶式拉背器: { mode: 'equipment', equipment: '蝶式拉背器' },
    高拉背器: { mode: 'equipment', equipment: '高拉背器' },
    大腿内外侧肌训练器: { mode: 'equipment', equipment: '大腿内外侧肌训练器' },
    平板支撑: { mode: 'bodyweight', equipment: '' },
    俯卧撑: { mode: 'bodyweight', equipment: '' },
    仰卧起坐: { mode: 'bodyweight', equipment: '' }
  });
});
