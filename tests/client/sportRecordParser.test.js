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
  const row = parseSportRecordRow(
    {
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
    },
    {
      formatTime: (ts) => (ts === 1700000000 ? '08:00' : '08:30'),
      formatDuration: (seconds) => `${seconds} sec`,
      getCategoryName: () => 'Running'
    }
  );

  assert.equal(row.timeRange, '08:00 - 08:30');
  assert.equal(row.duration, 1800);
  assert.equal(row.categoryName, 'Running');
  assert.deepEqual(row.hrZones, { warmup: 5, fatBurn: 10, aerobic: 20, anaerobic: 4, extreme: 1 });
});

test('filters out overnight records and classifies sport types', () => {
  // filterNightRecords 按「本地小时」判断（保留 hour >= 8 && hour < 23），所以夹具必须用
  // 本地时间分量构造。原写法把 +08:00 偏移写死进字面量：在 UTC+8 的开发机上
  // 02:00+08:00 正好解析成本地 2 点、10:00+08:00 解析成本地 10 点，碰巧通过；
  // 到了 UTC 的 CI 上，前者变成本地 18 点、后者变成本地 2 点，两条的判定正好反过来，
  // filtered[0] 取到了本该被过滤的那条。
  // （这个文件此前不在 pnpm test 的聚合清单里，所以时区依赖一直没被 CI 暴露。）
  const dayTime = Math.floor(new Date(2026, 8, 8, 10, 0, 0).getTime() / 1000);
  const nightTime = Math.floor(new Date(2026, 8, 8, 2, 0, 0).getTime() / 1000);
  const filtered = filterNightRecords([{ start_time: nightTime }, { start_time: dayTime }, { start_time: null }]);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].start_time, dayTime);
  assert.equal(isWalkingRecord({ sport_type: 22 }), true);
  assert.equal(isEllipticalRecord({ category: 'elliptical_trainer' }), true);
  assert.equal(isRowingRecord({ sport_type: 13 }), true);
});
