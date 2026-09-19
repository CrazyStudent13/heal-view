import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingPlanValidation } from '../../server/src/controllers/trainingPlanController.js';

test('validates real ISO calendar dates and ordered plan ranges', () => {
  assert.equal(trainingPlanValidation.isValidDate('2026-02-28'), true);
  assert.equal(trainingPlanValidation.isValidDate('2026-02-30'), false);

  const valid = trainingPlanValidation.validatePlanPayload({
    name: 'Autumn plan',
    startDate: '2026-09-01',
    endDate: '2026-12-31'
  });
  const invalid = trainingPlanValidation.validatePlanPayload({
    name: 'Invalid plan',
    startDate: '2026-10-01',
    endDate: '2026-09-01'
  });

  assert.equal(valid.errors, undefined);
  assert.ok(invalid.errors.endDate);
});

test('requires each training session exercise once and accepts positive targets', () => {
  const valid = trainingPlanValidation.validateSessionPayload({
    scheduledDate: '2026-09-17',
    items: [{ exerciseId: 1, targets: { duration: 30, distance: 3.5 } }]
  });
  const duplicate = trainingPlanValidation.validateSessionPayload({
    scheduledDate: '2026-09-17',
    items: [
      { exerciseId: 1, targets: { duration: 30 } },
      { exerciseId: 1, targets: { duration: 20 } }
    ]
  });
  const invalidTarget = trainingPlanValidation.validateSessionPayload({
    scheduledDate: '2026-09-17',
    items: [{ exerciseId: 1, targets: { duration: 0 } }]
  });

  assert.equal(valid.errors, undefined);
  assert.ok(duplicate.errors['items.1.exerciseId']);
  assert.ok(invalidTarget.errors['items.0.targets']);
});

test('accepts canonical duration targets in seconds', () => {
  const valid = trainingPlanValidation.validateSessionPayload({
    scheduledDate: '2026-09-17',
    items: [{ exerciseId: 1, targets: { durationSeconds: 90 } }]
  });
  const invalid = trainingPlanValidation.validateSessionPayload({
    scheduledDate: '2026-09-17',
    items: [{ exerciseId: 1, targets: { durationSeconds: 90.5 } }]
  });

  assert.equal(valid.errors, undefined);
  assert.ok(invalid.errors['items.0.targets']);
  assert.deepEqual(valid.value.items[0].targets, { durationSeconds: 90 });
});
