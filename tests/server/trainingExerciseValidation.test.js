import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingExerciseValidation } from '../../server/src/controllers/trainingExerciseController.js';

test('accepts only boolean training exercise enabled values', () => {
  assert.equal(trainingExerciseValidation.validateEnabled(true), true);
  assert.equal(trainingExerciseValidation.validateEnabled(false), true);
  assert.equal(trainingExerciseValidation.validateEnabled(1), false);
  assert.equal(trainingExerciseValidation.validateEnabled(undefined), false);
});

test('accepts only non-empty arrays of positive exercise ids', () => {
  assert.equal(trainingExerciseValidation.validateIds([1, '2', 2]), true);
  assert.equal(trainingExerciseValidation.validateIds([]), false);
  assert.equal(trainingExerciseValidation.validateIds([0]), false);
  assert.equal(trainingExerciseValidation.validateIds(['invalid']), false);
});

test('accepts Material Design icon identifiers and rejects other icon sources', () => {
  const valid = trainingExerciseValidation.validatePayload({
    name: 'Running',
    icon: 'mdi:run',
    scene: 'outdoor'
  });
  const invalid = trainingExerciseValidation.validatePayload({
    name: 'Running',
    icon: 'game-icons:run',
    scene: 'outdoor'
  });

  assert.equal(valid.errors, undefined);
  assert.equal(invalid.errors.icon, 'Invalid Material Design icon');
});

test('preserves valid training metrics and removes duplicates', () => {
  const result = trainingExerciseValidation.validatePayload({
    name: 'Cycling',
    icon: 'mdi:bike',
    scene: 'outdoor',
    metrics: ['duration', 'distance', 'duration', 'heart_rate']
  });

  assert.equal(result.errors, undefined);
  assert.deepEqual(result.value.metrics, ['duration', 'distance', 'heart_rate']);
});

test('requires an equipment name only for equipment exercises', () => {
  const invalid = trainingExerciseValidation.validatePayload({
    name: 'Cycling',
    icon: 'mdi:bike',
    scene: 'outdoor',
    equipmentMode: 'equipment'
  });
  const bodyweight = trainingExerciseValidation.validatePayload({
    name: 'Running',
    icon: 'mdi:run',
    scene: 'outdoor',
    equipmentMode: 'bodyweight',
    equipment: 'Ignored equipment'
  });

  assert.ok(invalid.errors.equipment);
  assert.equal(bodyweight.errors, undefined);
  assert.equal(bodyweight.value.equipment, '');
});
