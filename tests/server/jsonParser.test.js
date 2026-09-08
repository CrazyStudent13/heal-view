import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAggregatedData,
  parseSportRecord,
  parseWeeklyReport
} from '../../server/src/utils/jsonParser.js';

test('parses sport record payloads with safe defaults', () => {
  const record = parseSportRecord(JSON.stringify({
    calories: 320,
    total_cal: 500,
    duration: 1800,
    distance: 4200,
    avg_hrm: 126,
    max_hrm: 158,
    avg_speed: 2.1,
    max_speed: 4.2,
    start_time: 1700000000,
    end_time: 1700001800,
    sport_type: 'run',
    train_effect: 3
  }));

  assert.deepEqual(record, {
    calories: 320,
    totalCalories: 500,
    duration: 1800,
    distance: 4200,
    avgHeartRate: 126,
    maxHeartRate: 158,
    avgSpeed: 2.1,
    maxSpeed: 4.2,
    startTime: 1700000000,
    endTime: 1700001800,
    sportType: 'run',
    trainEffect: 3
  });
});

test('returns null for invalid sport record JSON', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(parseSportRecord('not-json'), null);
    assert.equal(parseSportRecord(''), null);
  } finally {
    console.error = originalError;
  }
});

test('parses weekly report and aggregated data JSON', () => {
  const report = parseWeeklyReport(JSON.stringify({
    sports_duration: { int_value: 120 },
    sport_times: 4,
    sport_days: 3,
    steps_summary: { int_value: 28000 },
    calorie_summary: { int_value: 1800 },
    sleep_report: { status: 'ok' },
    hlth_status: 'good'
  }));

  assert.deepEqual(report, {
    sportsDuration: 120,
    sportTimes: 4,
    sportDays: 3,
    stepsSummary: 28000,
    calorieSummary: 1800,
    sleepReport: { status: 'ok' },
    healthStatus: 'good'
  });

  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(parseAggregatedData('{"stress":45,"sleep":null}'), { stress: 45, sleep: null });
    assert.equal(parseAggregatedData('{bad json'), null);
  } finally {
    console.error = originalError;
  }
});
