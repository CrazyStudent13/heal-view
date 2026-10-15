/**
 * DailySportChart 的展示辅助函数测试。
 *
 * 这些函数原先是组件 <script setup> 里的内联函数，只能靠在浏览器里点开图表页
 * 才能验证；抽到 dailySportChartFormatters.js 之后可以直接断言。
 * 期望值按实现逐条写死，不用"跑一遍看结果"的方式生成，否则测试只会跟着实现走。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailySportChartFormatters } from '../../client/src/components/charts/dailySportChartFormatters.js';

// t 的替身：把 key 与参数原样暴露出来，便于断言"用了哪个 key、传了什么参数"。
const t = (key, params) => (params ? `${key}|${JSON.stringify(params)}` : key);
const f = createDailySportChartFormatters(t);

test('formatTime 输出 HH:MM，并在缺值时给出占位符', () => {
  assert.equal(f.formatTime(null), '--:--');
  assert.equal(f.formatTime(0), '--:--');
  assert.equal(f.formatTime(undefined), '--:--');

  // 用与实现相同的本地时间口径推导期望值（函数按本地时区渲染 HH:MM）。
  const ts = 1_700_000_000;
  const date = new Date(ts * 1000);
  const expected = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  assert.equal(f.formatTime(ts), expected);
  assert.match(f.formatTime(ts), /^\d{2}:\d{2}$/);
});

test('formatDuration 按时/分选择文案，零值走专用 key', () => {
  assert.equal(f.formatDuration(0), 'sport.zeroMinutes');
  assert.equal(f.formatDuration(null), 'sport.zeroMinutes');
  assert.equal(f.formatDuration(90), 'sport.durationMinutes|{"minutes":1}');
  assert.equal(f.formatDuration(3600), 'sport.durationHoursMinutes|{"hours":1,"minutes":0}');
  assert.equal(f.formatDuration(3660), 'sport.durationHoursMinutes|{"hours":1,"minutes":1}');
});

test('formatPace 把秒/公里换算成 km/h', () => {
  assert.equal(f.formatPace(0), '--');
  assert.equal(f.formatPace(null), '--');
  // 300 秒/公里 => 3600 / 300 = 12.0 km/h
  assert.equal(f.formatPace(300), '12.0 settings.units.kmh');
  // 240 秒/公里 => 15.0 km/h
  assert.equal(f.formatPace(240), '15.0 settings.units.kmh');
});

test('getRowingGroupDuration 只对赛艇(sport_type 13)计算，并排除休息时间', () => {
  assert.equal(f.getRowingGroupDuration(null), null);
  assert.equal(f.getRowingGroupDuration({ sport_type: 12, duration: 600 }), null);

  // 无分组数时无法求均时
  assert.equal(f.getRowingGroupDuration({ sport_type: 13, duration: 600, segmentCount: 0 }), null);

  // (600 - 100) / 5 = 100
  assert.equal(f.getRowingGroupDuration({ sport_type: 13, duration: 600, restTime: 100, segmentCount: 5 }), 100);
  // 没有 restTime 时按 0 处理：(900 - 0) / 3 = 300
  assert.equal(f.getRowingGroupDuration({ sport_type: 13, duration: 900, segmentCount: 3 }), 300);
});

test('getCategoryName 优先用 sport_type 码表，其次回退到 category 串', () => {
  assert.equal(f.getCategoryName({ sport_type: 1 }), 'sport.typeName.running');
  assert.equal(f.getCategoryName({ sport_type: 13 }), 'sport.typeName.rowing');
  assert.equal(f.getCategoryName({ sport_type: 22 }), 'sport.typeName.outdoorWalking');

  // sport_type 不在码表里 => 回退到 category
  assert.equal(f.getCategoryName({ sport_type: 99, category: 'rowing_machine' }), 'sport.typeName.rowing');
  assert.equal(f.getCategoryName({ category: 'outdoor_riding' }), 'sport.typeName.outdoorRiding');

  // 都没有时按 other 处理
  assert.equal(f.getCategoryName({}), 'sport.typeName.other');

  // 码表与 category 串都认不出 => 原样返回 category 串
  assert.equal(f.getCategoryName({ category: 'unknown_sport' }), 'unknown_sport');
});

test('isTrainingSegment 识别中英文训练段并忽略大小写', () => {
  assert.equal(f.isTrainingSegment('训练'), true);
  assert.equal(f.isTrainingSegment('training'), true);
  assert.equal(f.isTrainingSegment('TRAINING'), true);
  assert.equal(f.isTrainingSegment('work'), true);
  assert.equal(f.isTrainingSegment('rest'), false);
  assert.equal(f.isTrainingSegment(''), false);
  assert.equal(f.isTrainingSegment(null), false);
  assert.equal(f.isTrainingSegment(undefined), false);
});

test('getSegmentTypeLabel 按训练/休息给出不同文案', () => {
  assert.equal(f.getSegmentTypeLabel('training'), 'sport.training');
  assert.equal(f.getSegmentTypeLabel('rest'), 'sport.rest');
  assert.equal(f.getSegmentTypeLabel('训练'), 'sport.training');
});

test('getCategoryTagType 优先用 sport_type 码表，缺失时回退并兜底 info', () => {
  assert.equal(f.getCategoryTagType({ sport_type: 1 }), 'danger');
  assert.equal(f.getCategoryTagType({ sport_type: 3 }), 'success');
  assert.equal(f.getCategoryTagType({ sport_type: 13 }), 'primary');

  // 注意与 getCategoryName 的不对称：只要 sport_type 存在（非 undefined/null），
  // 就只查 sport_type 码表，查不到直接兜底 info，不会回退到 category。
  // 而 getCategoryName 在码表查不到时会回退到 category。这是实现现状，本次重构不改行为。
  assert.equal(f.getCategoryTagType({ sport_type: 99, category: 'running' }), 'info');

  // 完全没有 sport_type 时才走 category 码表
  assert.equal(f.getCategoryTagType({ category: 'running' }), 'danger');
  assert.equal(f.getCategoryTagType({ category: 'swimming' }), 'primary');

  // climbing 在 category 码表里是空串，falsy 兜底成 info（记录实现现状）
  assert.equal(f.getCategoryTagType({ category: 'climbing' }), 'info');
  assert.equal(f.getCategoryTagType({ category: 'unknown_sport' }), 'info');
  assert.equal(f.getCategoryTagType({}), 'info');
});

test('getPaceBarWidth 把配速反比映射成 0-100 并夹紧边界', () => {
  assert.equal(f.getPaceBarWidth(0), 0);
  assert.equal(f.getPaceBarWidth(null), 0);

  // 180 秒/公里是最快端 => 100%
  assert.equal(f.getPaceBarWidth(180), 100);
  // 600 秒/公里是最慢端 => 0%
  assert.equal(f.getPaceBarWidth(600), 0);
  // 正中间 (600-390)/(600-180) = 50%
  assert.equal(f.getPaceBarWidth(390), 50);

  // 比最快端还快 => 夹到 100；比最慢端还慢 => 夹到 0
  assert.equal(f.getPaceBarWidth(100), 100);
  assert.equal(f.getPaceBarWidth(900), 0);
});
