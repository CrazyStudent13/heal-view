import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessSleepRegularity,
  calculateCalorieEfficiency,
  classifyBloodPressure,
  classifyBloodPressureRecord,
  BLOOD_PRESSURE_STATUS,
  SLEEP_REGULARITY_STATUS
} from '../../client/src/domain/healthRules.js';

test('classifies blood pressure by clinical thresholds', () => {
  assert.equal(classifyBloodPressure(129, 84), BLOOD_PRESSURE_STATUS.NORMAL);
  assert.equal(classifyBloodPressure(130, 85), BLOOD_PRESSURE_STATUS.ELEVATED);
  assert.equal(classifyBloodPressure(140, 89), BLOOD_PRESSURE_STATUS.HIGH);
});

test('classifies blood pressure records using latest values first', () => {
  assert.equal(
    classifyBloodPressureRecord({ latestSystolic: 128, latestDiastolic: 82, systolic: 150, diastolic: 95 }),
    BLOOD_PRESSURE_STATUS.NORMAL
  );
  assert.equal(
    classifyBloodPressureRecord({ systolic: 131, diastolic: 84 }),
    BLOOD_PRESSURE_STATUS.ELEVATED
  );
});

test('calculates calorie efficiency and guards invalid inputs', () => {
  assert.equal(calculateCalorieEfficiency(300, 60), 5);
  assert.equal(calculateCalorieEfficiency(300, 0), null);
  assert.equal(calculateCalorieEfficiency(0, 60), null);
});

test('assesses sleep regularity with empty and clustered inputs', () => {
  const empty = assessSleepRegularity([null, '', 'bad']);
  assert.equal(empty.status, SLEEP_REGULARITY_STATUS.NONE);
  assert.equal(empty.score, null);
  assert.equal(empty.total, 0);

  const regular = assessSleepRegularity(['22:00', '22:15', '22:30', '22:45']);
  assert.equal(regular.status, SLEEP_REGULARITY_STATUS.REGULAR);
  assert.equal(regular.score, 10);
  assert.equal(regular.total, 4);
  assert.equal(regular.matched, 4);

  const mixed = assessSleepRegularity(['22:00', '22:15', '22:30', '18:00', '19:00']);
  assert.equal(mixed.status, SLEEP_REGULARITY_STATUS.MIXED);
  assert.equal(mixed.score, 4);
  assert.equal(mixed.total, 5);
});
