import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCategoryParam,
  normalizeDateParam,
  validateDateRange,
  validateMetric
} from '../../server/src/utils/requestValidation.js';

test('normalizes date and category params', () => {
  assert.equal(normalizeDateParam('2026-09-08'), '2026-09-08');
  assert.equal(normalizeDateParam(' 2026-09-08 '), '2026-09-08');
  assert.equal(normalizeDateParam('2026/09/08'), null);
  assert.equal(normalizeCategoryParam(' walking '), 'walking');
  assert.equal(normalizeCategoryParam('   '), null);
});

test('validates date range and metric names', () => {
  assert.deepEqual(validateDateRange('2026-09-01', '2026-09-08'), {
    startDate: '2026-09-01',
    endDate: '2026-09-08'
  });
  assert.equal(validateDateRange('2026-09-08', '2026-09-01'), null);
  assert.equal(validateMetric('sleep'), null);
  assert.equal(validateMetric('blood_pressure'), 'blood_pressure');
});
