// 训练单元的展示状态推导：把训练单元行、项目行和有氧匹配结果汇成同一个口径。
// 计划列表、计划详情和全局训练单元页共用这里，避免三处各推一份状态。
import { evaluateAerobicItem } from '../../services/aerobicMatching.js';
import { parseJson } from './queryHelpers.js';

export function effectiveSessionStatus(plannedStatus, executionStatus, itemCount = 0, loggedItemCount = 0) {
  if (executionStatus === 'completed') {
    return itemCount > 0 && loggedItemCount < itemCount ? 'partial' : 'achieved';
  }
  if (executionStatus === 'partial') return 'partial';
  if (executionStatus === 'skipped') return 'skipped';
  return plannedStatus;
}

// —— 有氧训练自动匹配 ——
// 匹配结果只在读取时计算，从不写回 training_sessions.status，
// 这样重新导入或清空导入数据后结果会自然重算，历史计划也不会被导入数据改写。

/**
 * 把自动匹配结果汇总成训练单元状态。
 * 人工确认优先：只要手机端或计划页留下过执行记录，就沿用人工判定，自动匹配不覆盖。
 * 还有人工项目没确认时保持原状态，避免"器械还没打卡"被有氧数据带成已完成。
 * @param {object} params 汇总入参
 * @returns {string} 训练单元状态
 */
export function deriveSessionStatus({
  plannedStatus,
  scheduledDate,
  today,
  executionStatus,
  itemCount,
  loggedItemCount,
  manualItemCount,
  pendingManualItemCount,
  autoMatches
}) {
  // 有人工执行记录时完全沿用手工判定，自动匹配不参与。
  if (executionStatus) return effectiveSessionStatus(plannedStatus, executionStatus, itemCount, loggedItemCount);
  // 状态已经被手工设置过（例如直接标记完成）时不覆盖。
  if (plannedStatus !== 'planned') return plannedStatus;
  // 还有人工项目没确认，或者整个单元都是人工项目，都保持原状态。
  if (pendingManualItemCount > 0) return plannedStatus;
  if (manualItemCount === itemCount) return plannedStatus;
  if (!scheduledDate || scheduledDate >= today) return plannedStatus;

  const statuses = autoMatches.map((match) => match.status).filter(Boolean);
  if (statuses.length === 0) return plannedStatus;
  if (statuses.every((status) => status === 'achieved')) return 'achieved';
  if (statuses.some((status) => status === 'achieved' || status === 'partial')) return 'partial';
  if (statuses.some((status) => status === 'unverifiable')) return 'unverifiable';
  return 'no_data';
}

/**
 * 把训练单元行和它的项目行交给同一个推导口径。
 * 计划列表、计划详情和全局训练单元页共用这里，避免三处各推一份状态。
 * @param {object} session 训练单元行，需带 item_count、logged_item_count、execution_status
 * @param {Array<object>} sessionItems 该训练单元的项目行
 * @param {Map<number, object>} matches 项目 id → 有氧匹配结果
 * @param {string} today 今天的日期
 * @returns {{ status: string, autoMatches: Array<object> }} 派生状态与其中的自动匹配结果
 */
export function deriveStatusForSession(session, sessionItems, matches, today) {
  const manualItems = sessionItems.filter((item) => item.verification_mode === 'manual');
  const autoMatches = sessionItems
    .filter((item) => item.verification_mode !== 'manual')
    .map((item) => matches.get(Number(item.id)))
    .filter(Boolean);
  const status = deriveSessionStatus({
    // 列表查询取的是 s.*（status），汇总查询把它别名成 planned_status，两处都能用。
    plannedStatus: session.planned_status ?? session.status,
    scheduledDate: session.scheduled_date,
    today,
    executionStatus: session.execution_status || '',
    itemCount: Number(session.item_count) || 0,
    loggedItemCount: Number(session.logged_item_count) || 0,
    manualItemCount: manualItems.length,
    pendingManualItemCount: manualItems.filter((item) => !Number(item.item_log_count)).length,
    autoMatches
  });
  return { status, autoMatches };
}

/**
 * 列表展示和筛选用的完成状态：过期了但推导结果还是 planned 的训练单元算未完成，
 * 和训练日历上的 missed 是同一个口径。
 * "无数据"不并进未完成：那是缺导入数据，不是判定没练，两者在系统里一直是分开的。
 * @param {string} status 派生状态
 * @param {string} scheduledDate 训练单元日期
 * @param {string} today 今天的日期
 * @returns {string} 展示状态
 */
export function completionStatusOf(status, scheduledDate, today) {
  return status === 'planned' && scheduledDate && scheduledDate < today ? 'missed' : status;
}

/**
 * 评估一批训练单元的自动验证项目。
 * @param {Array<object>} itemRows 训练项目行，需带 scheduled_date、verification_mode、targets、exercise_sport_types
 * @param {Array<object>} records 归一后的导入运动记录
 * @param {string} today 今天的日期
 * @returns {Map<number, object>} 训练项目 id → 匹配结果
 */
export function evaluateAutoMatches(itemRows, records, today) {
  const matches = new Map();
  for (const row of itemRows) {
    if (row.verification_mode === 'manual') continue;
    matches.set(
      Number(row.id),
      evaluateAerobicItem({
        targets: parseJson(row.targets, {}),
        sportTypes: parseJson(row.exercise_sport_types, []),
        records,
        scheduledDate: row.scheduled_date,
        today
      })
    );
  }
  return matches;
}
