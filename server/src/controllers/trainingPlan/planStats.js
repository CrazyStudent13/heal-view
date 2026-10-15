// 计划列表和详情共用的批量统计：覆盖率、达成度和加练日。
import { summarizeCoverage } from '../../services/aerobicMatching.js';
import { computePlanAdherence } from '../../services/planAdherence.js';
import { loadNormalizedSportRecords } from '../../services/sportRecordRepository.js';
import { parseJson, queryRows } from './queryHelpers.js';
import { deriveStatusForSession, evaluateAutoMatches } from './sessionStatus.js';

/**
 * 计划列表用的批量统计：一次算完多个计划的数据覆盖率、达成度和加练日。
 * 固定几条查询覆盖全部计划，避免按计划逐个查询。
 *
 * 达成度口径见 services/planAdherence.js：分母是已过期且不被 cancelled 阶段覆盖的训练日，
 * 分子是履约日加加练日，所以比率可以超过 100%。
 * @param {number[]} planIds 计划 id
 * @param {string} today 今天的日期
 * @param {Array<object>|null} preloadedRecords 已经读好的导入记录；详情页同一个区间会复用，传了就跳过重复读取
 * @returns {Map<number, { coverage: object, adherence: object, extraDates: string[] }>} 计划 id → 统计
 */
export function computePlanStats(planIds, today, preloadedRecords = null) {
  const stats = new Map();
  if (planIds.length === 0) return stats;
  const placeholders = planIds.map(() => '?').join(', ');

  const planRows = queryRows(
    `SELECT id, start_date, end_date FROM training_plans WHERE id IN (${placeholders})`,
    planIds
  );
  if (planRows.length === 0) return stats;

  const cancelledPhaseRows = queryRows(
    `SELECT plan_id, start_date, end_date FROM training_phases
     WHERE plan_id IN (${placeholders}) AND status = 'cancelled'`,
    planIds
  );
  const cancelledPhasesByPlan = Map.groupBy(cancelledPhaseRows, (row) => Number(row.plan_id));

  const sessionRows = queryRows(
    `SELECT s.id, s.plan_id, s.scheduled_date, s.status AS planned_status,
       log.status AS execution_status,
       (SELECT COUNT(*) FROM training_session_items counted_item WHERE counted_item.session_id = s.id) AS item_count,
       (SELECT COUNT(*) FROM training_session_log_items logged_item
          JOIN training_session_logs logged_log ON logged_log.id = logged_item.session_log_id
          WHERE logged_log.session_id = s.id) AS logged_item_count
     FROM training_sessions s
     LEFT JOIN training_session_logs log ON log.session_id = s.id
     WHERE s.plan_id IN (${placeholders})`,
    planIds
  );

  const itemRows = queryRows(
    `SELECT i.id, i.session_id, i.verification_mode, i.targets,
       s.plan_id AS plan_id, s.scheduled_date AS scheduled_date,
       e.sport_types AS exercise_sport_types,
       (SELECT COUNT(*) FROM training_session_log_items item_log
          JOIN training_session_logs item_log_head ON item_log_head.id = item_log.session_log_id
          WHERE item_log.session_item_id = i.id) AS item_log_count
     FROM training_session_items i
     JOIN training_exercises e ON e.id = i.exercise_id
     JOIN training_sessions s ON s.id = i.session_id
     WHERE s.plan_id IN (${placeholders})`,
    planIds
  );

  // 加练日可能落在没有任何训练单元的日子上，所以区间取计划自身的起止日期，
  // 而不是训练单元的 MIN/MAX（那个区间不保证覆盖计划的头尾）。
  const planStartDates = planRows.map((row) => row.start_date).sort();
  const planEndDates = planRows.map((row) => row.end_date).sort();
  const records = preloadedRecords ?? loadNormalizedSportRecords(planStartDates[0], planEndDates.at(-1));
  const matches = evaluateAutoMatches(itemRows, records, today);
  const itemsBySession = Map.groupBy(itemRows, (row) => Number(row.session_id));

  const buckets = new Map();
  for (const session of sessionRows) {
    const sessionItems = itemsBySession.get(Number(session.id)) || [];
    const { status, autoMatches } = deriveStatusForSession(session, sessionItems, matches, today);

    const planId = Number(session.plan_id);
    const bucket = buckets.get(planId) || { autoMatches: [], sessions: [], sportTypes: new Set() };
    bucket.autoMatches.push(...autoMatches);
    // 达成度按派生状态算，保证和计划详情里日历上看到的判定完全一致。
    bucket.sessions.push({ scheduledDate: session.scheduled_date, status });
    for (const item of sessionItems) {
      for (const sportType of parseJson(item.exercise_sport_types, [])) bucket.sportTypes.add(sportType);
    }
    buckets.set(planId, bucket);
  }

  for (const planRow of planRows) {
    const planId = Number(planRow.id);
    const bucket = buckets.get(planId) || { autoMatches: [], sessions: [], sportTypes: new Set() };
    const adherence = computePlanAdherence({
      startDate: planRow.start_date,
      endDate: planRow.end_date,
      today,
      sessions: bucket.sessions,
      cancelledPhaseRanges: (cancelledPhasesByPlan.get(planId) || []).map((row) => ({
        startDate: row.start_date,
        endDate: row.end_date
      })),
      records,
      sportTypes: [...bucket.sportTypes]
    });
    stats.set(planId, {
      coverage: summarizeCoverage(bucket.autoMatches),
      adherence: {
        eligibleDays: adherence.eligibleDays,
        fulfilledDays: adherence.fulfilledDays,
        extraDays: adherence.extraDays,
        completedDays: adherence.completedDays,
        rate: adherence.rate,
        tier: adherence.tier
      },
      extraDates: adherence.extraDates
    });
  }
  return stats;
}
