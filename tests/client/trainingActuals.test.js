/**
 * 移动端打卡页 actuals 构造的测试。
 *
 * 服务端按动作声明的指标严格校验 actuals：提交一个该动作不支持的指标，整次保存会被判 400。
 * 这三个函数原先内联在 TrainingPage.vue 里，只能在手机上点着试；抽到 trainingActuals.js
 * 之后可以直接覆盖「哪些动作该写哪些键」这类边界。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyActuals, targetActuals, targetDurationSeconds } from '../../client/src/pages/mobile/trainingActuals.js';

test('targetDurationSeconds 优先用 durationSeconds，其次把 duration 按单位换算', () => {
  assert.equal(targetDurationSeconds({ durationSeconds: 90 }), 90);
  // 四舍五入到整秒
  assert.equal(targetDurationSeconds({ durationSeconds: 90.4 }), 90);
  assert.equal(targetDurationSeconds({ durationSeconds: 90.6 }), 91);

  // duration 默认按分钟换算成秒
  assert.equal(targetDurationSeconds({ duration: 5 }), 300);
  // 显式声明 seconds 时不再乘 60
  assert.equal(targetDurationSeconds({ duration: 5, durationUnit: 'seconds' }), 5);

  assert.equal(targetDurationSeconds({}), 0);
  assert.equal(targetDurationSeconds({ duration: 0 }), 0);
  assert.equal(targetDurationSeconds({ duration: 'abc' }), 0);
});

test('targetActuals 只写动作声明支持的指标', () => {
  // 声明了 sets 与 weight：两个都写
  assert.deepEqual(targetActuals({ exercise: { metrics: ['sets', 'weight'] }, targets: { sets: 3, weight: 20 } }), {
    sets: 3,
    weight: 20
  });

  // 声明了 resistance 但没声明 sets：即使计划 targets 里有 sets 也不能写
  // （椭圆机等纯时长/阻力动作提交 sets 会被服务端拒绝整次保存）
  assert.deepEqual(targetActuals({ exercise: { metrics: ['resistance'] }, targets: { resistance: 8, sets: 3 } }), {
    resistance: 8
  });

  // duration 一律不直接写入，改用 durationSeconds
  assert.deepEqual(targetActuals({ exercise: { metrics: ['duration'] }, targets: { duration: 10 } }), {
    durationSeconds: 600
  });

  // durationSeconds 已显式给出时不再由 duration 覆盖
  assert.deepEqual(targetActuals({ exercise: { metrics: ['duration'] }, targets: { durationSeconds: 45 } }), {
    durationSeconds: 45
  });
});

test('targetActuals 对不支持/非正数的目标值保持沉默', () => {
  // sets 目标缺失时补 1，避免"完成本项"写不出任何组数
  assert.deepEqual(targetActuals({ exercise: { metrics: ['sets'] }, targets: {} }), { sets: 1 });

  // 值为 0 或非数字时不写入
  assert.deepEqual(targetActuals({ exercise: { metrics: ['weight'] }, targets: { weight: 0 } }), {});
  assert.deepEqual(targetActuals({ exercise: { metrics: ['weight'] }, targets: { weight: 'abc' } }), {});

  // 缺 item / 缺 exercise 时不炸，也不写入任何键
  assert.deepEqual(targetActuals(null), {});
  assert.deepEqual(targetActuals({}), {});
  assert.deepEqual(targetActuals({ targets: {} }), {});
});

test('emptyActuals 覆盖草稿与目标的全部键，但把 duration 换成 durationSeconds', () => {
  // 草稿里的键与计划目标里的键都要清空，另外补上 sets / durationSeconds
  assert.deepEqual(emptyActuals({ targets: { sets: 3, weight: 20 } }, { sets: 2 }), {
    durationSeconds: null,
    sets: null,
    weight: null
  });

  // duration 不是可提交的键：清空时把它删掉，只留 durationSeconds
  assert.deepEqual(emptyActuals({ targets: { duration: 10 } }, { duration: 5 }), {
    durationSeconds: null,
    sets: null
  });

  assert.deepEqual(emptyActuals(null), { durationSeconds: null, sets: null });
  assert.deepEqual(emptyActuals({}, {}), { durationSeconds: null, sets: null });
});
