import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrainingExercisePayload, updateMetricSelection } from '../../client/src/utils/trainingExercise.js';

test('updates selected training metrics without mutating the existing array', () => {
  const initial = ['duration'];
  const selected = updateMetricSelection(initial, 'distance', true);
  const deselected = updateMetricSelection(selected, 'duration', false);

  assert.deepEqual(initial, ['duration']);
  assert.deepEqual(selected, ['duration', 'distance']);
  assert.deepEqual(deselected, ['distance']);
});

test('copies selected metrics into the training exercise request payload', () => {
  const form = {
    name: 'Cycling',
    icon: 'mdi:bike',
    category: 'aerobic',
    scene: 'outdoor',
    verificationMode: 'auto',
    equipmentMode: 'equipment',
    equipment: 'Bicycle',
    metrics: ['duration', 'distance'],
    purpose: 'Cardio'
  };

  const payload = buildTrainingExercisePayload(form);
  form.metrics.push('speed');

  assert.deepEqual(payload.metrics, ['duration', 'distance']);
  assert.equal(payload.equipmentMode, 'equipment');
  assert.equal(payload.equipment, 'Bicycle');
});
