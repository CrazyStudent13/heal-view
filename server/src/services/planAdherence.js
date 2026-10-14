/**
 * 训练计划的两个正交维度：生命周期与达成度。
 *
 * 这两个维度刻意分开，不合并成一个 status 字段：
 * - 生命周期回答"这个计划现在处在什么时间位置"，可以由日期推导，不需要落库。
 * - 达成度回答"该练的日子我履约了多少"，由训练单元和导入记录推导，也不能落库。
 *
 * 达成度口径（产品约定，改动前先看 docs/todos/training-plan.md）：
 * - 分母 = 已过期、且仍属于有效计划的训练日。被取消或提前结束的阶段所占的日子不计入，
 *   这样因为手术、身体状态而顺延或终止的阶段不会倒扣分。
 * - 分子 = 履约日 + 加练日。
 *   - 履约日：该训练日的派生状态为 achieved / partial，或留下过人工执行记录。
 *     部分达标算履约（人来了、卡打了），做多做少交给训练质量指标去评价。
 *   - 加练日：计划区间内存在匹配该计划运动类型的导入记录，但当天没有训练单元。
 *     加练计入分子，所以比率可以超过 100%，表示"以量补欠"。
 * - 没有导入数据同样算缺席。这是打卡口径：计划一旦开始就不能停止，
 *   缺少证据的那天就是没打卡，需要用户通过补卡入口自己声明。
 */

import { collectRecordSportTypeKeys } from '../utils/sportTypes.js';

/** 视为"已履约"的训练单元派生状态。部分达标也算履约，人来了卡就打了。 */
const FULFILLED_SESSION_STATUSES = new Set(['achieved', 'partial']);

/** 达成度档位，从高到低。 */
export const ADHERENCE_TIERS = Object.freeze([
  'complete',
  'minor_gaps',
  'slight_shortfall',
  'clear_shortfall',
  'barely_trained',
  'absent'
]);

/** 生命周期取值，由日期推导，不含"已归档"——归档是独立的意图位。 */
export const PLAN_LIFECYCLES = Object.freeze(['draft', 'active', 'ended']);

function toCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

/**
 * 由达成度比率取档位。
 *
 * 区间取半开，避免边界归属含糊：
 * `[1, ∞)` complete，`[0.75, 1)` minor_gaps，`[0.5, 0.75)` slight_shortfall，
 * `[0.3, 0.5)` clear_shortfall，`(0, 0.3)` barely_trained，`{0}` absent。
 *
 * @param {number|null} rate 达成度比率，可以是超过 1 的加练结果
 * @returns {string|null} 档位；没有可用的分母时返回 null，调用方应显示"暂无"而不是"完全缺席"
 */
export function adherenceTier(rate) {
  if (rate == null || !Number.isFinite(rate)) return null;
  if (rate <= 0) return 'absent';
  if (rate < 0.3) return 'barely_trained';
  if (rate < 0.5) return 'clear_shortfall';
  if (rate < 0.75) return 'slight_shortfall';
  if (rate < 1) return 'minor_gaps';
  return 'complete';
}

/**
 * 汇总达成度。
 *
 * @param {{ eligibleDays?: number, fulfilledDays?: number, extraDays?: number }} input
 *   eligibleDays 已过期且仍有效的训练日数（分母）；
 *   fulfilledDays 其中有履约的训练日数；
 *   extraDays 其中没有训练单元、但有匹配导入记录的加练日数。
 * @returns {{
 *   eligibleDays: number, fulfilledDays: number, extraDays: number,
 *   completedDays: number, rate: number|null, tier: string|null
 * }}
 *   rate 在分母为 0 时为 null；tier 随之也为 null。
 */
export function summarizePlanAdherence({ eligibleDays = 0, fulfilledDays = 0, extraDays = 0 } = {}) {
  const eligible = toCount(eligibleDays);
  const fulfilled = toCount(fulfilledDays);
  const extra = toCount(extraDays);
  const completed = fulfilled + extra;
  const rate = eligible > 0 ? completed / eligible : null;
  return {
    eligibleDays: eligible,
    fulfilledDays: fulfilled,
    extraDays: extra,
    completedDays: completed,
    rate,
    tier: adherenceTier(rate)
  };
}

/**
 * 由日期推导计划的生命周期，归档与否是正交的独立信息。
 *
 * 不落库的原因：一旦把"进行中"存成字段，就会和训练单元、阶段状态形成多个真相来源。
 * 真正推不出来的只有"用户主动归档"这一个意图，所以只存 archived_at 一个时间戳。
 *
 * @param {{ startDate: string, endDate: string, archivedAt?: number|null }} plan
 * @param {string} today YYYY-MM-DD
 * @returns {{ lifecycle: string, archived: boolean, archivedAt: number|null }}
 */
export function resolvePlanLifecycle({ startDate, endDate, archivedAt = null } = {}, today) {
  const archived = archivedAt != null;
  let lifecycle = 'active';
  if (!today || today < startDate) lifecycle = 'draft';
  else if (today > endDate) lifecycle = 'ended';
  return {
    lifecycle,
    archived,
    archivedAt: archived ? Number(archivedAt) : null
  };
}

/**
 * 按天算出一个计划的达成度。
 *
 * 分子分母都以"天"为单位去重：一天里多个训练单元算一天，其中任何一个达标或部分达标
 * 就算这天履约（打卡是按天打的）。
 *
 * @param {{
 *   startDate?: string, endDate?: string, today?: string,
 *   sessions?: Array<{ scheduledDate: string, status: string }>,
 *   cancelledPhaseRanges?: Array<{ startDate: string, endDate: string }>,
 *   records?: Array<object>, sportTypes?: string[]
 * }} input
 *   sessions 的 status 必须是派生状态（deriveSessionStatus 的结果），不是库里存的原始值；
 *   records 是 loadNormalizedSportRecords 的归一记录。
 * @returns {{
 *   eligibleDays: number, fulfilledDays: number, extraDays: number,
 *   completedDays: number, rate: number|null, tier: string|null, extraDates: string[]
 * }}
 *   extraDates 只有加练日能算出来，履约日由训练单元状态就能推出，所以不重复返回。
 */
export function computePlanAdherence({
  startDate,
  endDate,
  today,
  sessions = [],
  cancelledPhaseRanges = [],
  records = [],
  sportTypes = []
} = {}) {
  // 被取消的阶段整段退出达成度：既不算分母，也不算分子，
  // 这样因为手术或身体状态终止的阶段不会倒扣分。
  const isRetired = (date) => cancelledPhaseRanges.some((range) => date >= range.startDate && date <= range.endDate);

  const sessionDates = new Set();
  const fulfilledDates = new Set();
  for (const session of sessions) {
    const date = session?.scheduledDate;
    if (!date) continue;
    sessionDates.add(date);
    if (FULFILLED_SESSION_STATUSES.has(session.status) && date < today && !isRetired(date)) {
      fulfilledDates.add(date);
    }
  }

  const eligibleDates = [...sessionDates].filter((date) => date < today && !isRetired(date));

  // 加练日：计划区间内、当天没有训练单元、但练了该计划认的运动类型。
  // 这些日子进分子，所以达成度可以超过 100%（以量补欠）。
  const configuredSportTypes = new Set(sportTypes);
  const extraDates = [];
  if (configuredSportTypes.size > 0 && startDate && endDate && today) {
    const counted = new Set();
    for (const record of records) {
      const date = record?.date;
      if (!date || date < startDate || date > endDate || date >= today) continue;
      if (sessionDates.has(date) || isRetired(date) || counted.has(date)) continue;
      if (collectRecordSportTypeKeys(record.raw).some((key) => configuredSportTypes.has(key))) {
        counted.add(date);
        extraDates.push(date);
      }
    }
  }

  const summary = summarizePlanAdherence({
    eligibleDays: eligibleDates.length,
    fulfilledDays: fulfilledDates.size,
    extraDays: extraDates.length
  });
  return { ...summary, extraDates: extraDates.sort() };
}
