import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterNightRecords,
  isEllipticalRecord,
  isRowingRecord,
  isWalkingRecord,
  parseSportRecordRow
} from '../../client/src/utils/sportRecordParser.js';

test('parses a sport record row into normalized display data', () => {
  const row = parseSportRecordRow({
    time: 1700000000,
    category: 'running',
    value: JSON.stringify({
      start_time: 1700000000,
      end_time: 1700001800,
      duration: 1800,
      calories: 320,
      distance: 4200,
      steps: 5300,
      avg_hrm: 124,
      max_hrm: 158,
      hr_zones: { warmup: 5, fatBurn: 10, aerobic: 20, anaerobic: 4, extreme: 1 }
    })
  }, {
    formatTime: (ts) => ts === 1700000000 ? '08:00' : '08:30',
    formatDuration: (seconds) => `${seconds} sec`,
    getCategoryName: () => 'Running'
  });

  assert.equal(row.timeRange, '08:00 - 08:30');
  assert.equal(row.duration, 1800);
  assert.equal(row.categoryName, 'Running');
  assert.deepEqual(row.hrZones, { warmup: 5, fatBurn: 10, aerobic: 20, anaerobic: 4, extreme: 1 });
});

test('filters out overnight records and classifies sport types', () => {
  const dayTime = Math.floor(Date.parse('2026-09-08T10:00:00+08:00') / 1000);
  const nightTime = Math.floor(Date.parse('2026-09-08T02:00:00+08:00') / 1000);
  const filtered = filterNightRecords([
    { start_time: nightTime },
    { start_time: dayTime },
    { start_time: null }
  ]);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].start_time, dayTime);
  assert.equal(isWalkingRecord({ sport_type: 22 }), true);
  assert.equal(isEllipticalRecord({ category: 'elliptical_trainer' }), true);
  assert.equal(isRowingRecord({ sport_type: 13 }), true);
});
