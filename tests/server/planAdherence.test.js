import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADHERENCE_TIERS,
  PLAN_LIFECYCLES,
  adherenceTier,
  resolvePlanLifecycle,
  summarizePlanAdherence
} from '../../server/src/services/planAdherence.js';

test('adherenceTier 的六个档位按半开区间划分，边界不重叠', () => {
  assert.equal(adherenceTier(1), 'complete');
  assert.equal(adherenceTier(0.75), 'minor_gaps');
  assert.equal(adherenceTier(0.5), 'slight_shortfall');
  assert.equal(adherenceTier(0.3), 'clear_shortfall');
  assert.equal(adherenceTier(0.001), 'barely_trained');
  assert.equal(adherenceTier(0), 'absent');
});

test('adherenceTier 落在区间内部时取所属档位', () => {
  assert.equal(adherenceTier(0.99), 'minor_gaps');
  assert.equal(adherenceTier(0.749), 'slight_shortfall');
  assert.equal(adherenceTier(0.499), 'clear_shortfall');
  assert.equal(adherenceTier(0.299), 'barely_trained');
  assert.equal(adherenceTier(0.6), 'slight_shortfall');
  assert.equal(adherenceTier(0.9), 'minor_gaps');
});

test('adherenceTier 允许超过 100% 的加练结果，并归入最高档', () => {
  assert.equal(adherenceTier(1.05), 'complete');
  assert.equal(adherenceTier(3), 'complete');
});

test('adherenceTier 在没有分母时返回 null，而不是误报完全缺席', () => {
  assert.equal(adherenceTier(null), null);
  assert.equal(adherenceTier(undefined), null);
  assert.equal(adherenceTier(Number.NaN), null);
  assert.equal(adherenceTier(Number.POSITIVE_INFINITY), null);
});

test('ADHERENCE_TIERS 覆盖全部档位且从高到低排列', () => {
  assert.deepEqual(
    [...ADHERENCE_TIERS],
    ['complete', 'minor_gaps', 'slight_shortfall', 'clear_shortfall', 'barely_trained', 'absent']
  );
  for (const rate of [1.2, 0.8, 0.6, 0.4, 0.1, 0]) {
    assert.ok(ADHERENCE_TIERS.includes(adherenceTier(rate)));
  }
});

test('summarizePlanAdherence 用履约日加加练日做分子，比率可以超过 100%', () => {
  const summary = summarizePlanAdherence({ eligibleDays: 20, fulfilledDays: 18, extraDays: 3 });
  assert.equal(summary.eligibleDays, 20);
  assert.equal(summary.fulfilledDays, 18);
  assert.equal(summary.extraDays, 3);
  assert.equal(summary.completedDays, 21);
  assert.equal(summary.rate, 1.05);
  assert.equal(summary.tier, 'complete');
});

test('summarizePlanAdherence 在分母为 0 时不给出比率和档位', () => {
  const summary = summarizePlanAdherence({ eligibleDays: 0, fulfilledDays: 0, extraDays: 2 });
  assert.equal(summary.eligibleDays, 0);
  assert.equal(summary.rate, null);
  assert.equal(summary.tier, null);
});

test('summarizePlanAdherence 忽略负数与非法值，避免出现负的达成度', () => {
  const summary = summarizePlanAdherence({ eligibleDays: '12', fulfilledDays: -5, extraDays: Number.NaN });
  assert.equal(summary.eligibleDays, 12);
  assert.equal(summary.fulfilledDays, 0);
  assert.equal(summary.extraDays, 0);
  assert.equal(summary.rate, 0);
  assert.equal(summary.tier, 'absent');
});

test('summarizePlanAdherence 无参数时返回空口径', () => {
  const summary = summarizePlanAdherence();
  assert.deepEqual(summary, {
    eligibleDays: 0,
    fulfilledDays: 0,
    extraDays: 0,
    completedDays: 0,
    rate: null,
    tier: null
  });
});

test('resolvePlanLifecycle 按今天与起止日期推导生命周期', () => {
  const plan = { startDate: '2026-07-01', endDate: '2026-12-31' };
  assert.equal(resolvePlanLifecycle(plan, '2026-06-30').lifecycle, 'draft');
  assert.equal(resolvePlanLifecycle(plan, '2026-07-01').lifecycle, 'active');
  assert.equal(resolvePlanLifecycle(plan, '2026-12-31').lifecycle, 'active');
  assert.equal(resolvePlanLifecycle(plan, '2027-01-01').lifecycle, 'ended');
  assert.deepEqual([...PLAN_LIFECYCLES], ['draft', 'active', 'ended']);
});

test('归档是与生命周期正交的意图位，不覆盖生命周期', () => {
  const archivedAt = 1_800_000_000_000;
  const plan = { startDate: '2026-07-01', endDate: '2026-12-31', archivedAt };
  const active = resolvePlanLifecycle(plan, '2026-08-01');
  assert.equal(active.lifecycle, 'active');
  assert.equal(active.archived, true);
  assert.equal(active.archivedAt, archivedAt);

  const ended = resolvePlanLifecycle(plan, '2027-02-01');
  assert.equal(ended.lifecycle, 'ended');
  assert.equal(ended.archived, true);

  const plain = resolvePlanLifecycle({ startDate: '2026-07-01', endDate: '2026-12-31' }, '2026-08-01');
  assert.equal(plain.archived, false);
  assert.equal(plain.archivedAt, null);
});
