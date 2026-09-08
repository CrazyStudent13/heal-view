import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBloodPressureRecord,
  normalizeDailySummary,
  normalizeSleepTimeline,
  normalizeWeightData
} from '../../client/src/domain/healthDataFallbacks.js';

test('normalizes blood pressure records and fills missing values', () => {
  const record = normalizeBloodPressureRecord({
    time: 1700000000,
    systolic: '138',
    diastolic: '88',
    heartRate: 'abc'
  });

  assert.deepEqual(record, {
    time: 1700000000,
    systolic: 138,
    diastolic: 88,
    heartRate: null
  });
});

test('normalizes daily summary with fallback date and derived blood pressure count', () => {
  const summary = normalizeDailySummary({
    steps: '1200',
    calories: '456',
    bloodPressureRecords: [
      { systolic: 125, diastolic: 80, heartRate: 72 },
      { systolic: 'bad', diastolic: 0 }
    ],
    latestBloodPressure: { systolic: 130, diastolic: 85, heartRate: 74 }
  }, '2026-09-08');

  assert.equal(summary.date, '2026-09-08');
  assert.equal(summary.steps, 1200);
  assert.equal(summary.calories, 456);
  assert.equal(summary.bloodPressureCount, 2);
  assert.equal(summary.latestBloodPressure.systolic, 130);
  assert.equal(summary.bloodPressureRecords[1].systolic, 0);
});

test('normalizes sleep timeline and weight data', () => {
  const timeline = normalizeSleepTimeline({
    totalDuration: '480',
    avgHeartRate: 'null',
    segments: null,
    heartRateData: [{ value: 60 }]
  }, '2026-09-08');

  assert.equal(timeline.date, '2026-09-08');
  assert.equal(timeline.totalDuration, 480);
  assert.equal(timeline.avgHeartRate, null);
  assert.deepEqual(timeline.segments, []);
  assert.deepEqual(timeline.heartRateData, [{ value: 60 }]);

  const weight = normalizeWeightData({
    dailyData: [
      { date: '2026-09-07', avgWeight: '65.2' },
      { date: '', avgWeight: '66' }
    ]
  });

  assert.equal(weight.dailyData.length, 1);
  assert.equal(weight.dailyData[0].avgWeight, 65.2);
});
