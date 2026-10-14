import { databaseService } from '../services/database.js';
import { isTrainingMetric } from '../utils/trainingMetrics.js';
import { evaluateAerobicItem, summarizeCoverage, summarizeItemResults } from '../services/aerobicMatching.js';
import { loadNormalizedSportRecords, todayDateKey } from '../services/sportRecordRepository.js';
import { computePlanAdherence, resolvePlanLifecycle, summarizePlanAdherence } from '../services/planAdherence.js';

const PHASE_STATUSES = new Set(['planned', 'active', 'paused', 'completed', 'cancelled']);
const SESSION_STATUSES = new Set(['planned', 'achieved', 'partial', 'no_data', 'unverifiable', 'skipped']);
// 全局训练单元页的筛选项：只保留"练完没有"这一类结果，待开始是时间位置、无数据和无法验证是
// 数据问题，都不参与筛选。未完成不是存量状态，是过期且推导结果仍为 planned（见下面的口径）。
const SESSION_COMPLETION_STATUSES = new Set(['achieved', 'partial', 'skipped', 'missed']);
const MAX_FATIGUE_LEVEL = 10;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function queryRows(sql, params = []) {
  const result = databaseService.query(sql, params);
  if (result.length === 0) return [];
  return result[0].values.map((values) =>
    Object.fromEntries(result[0].columns.map((column, index) => [column, values[index]]))
  );
}

function queryRow(sql, params = []) {
  return queryRows(sql, params)[0] || null;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function text(value, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length <= maxLength ? normalized : null;
}

function validateDateRange(startDate, endDate, errors) {
  if (!isValidDate(startDate)) errors.startDate = 'Use a valid YYYY-MM-DD start date';
  if (!isValidDate(endDate)) errors.endDate = 'Use a valid YYYY-MM-DD end date';
  if (!errors.startDate && !errors.endDate && startDate > endDate) {
    errors.endDate = 'End date must not be before start date';
  }
}

function validatePlanPayload(payload = {}) {
  const value = {
    name: text(payload.name, 100),
    goal: text(payload.goal, 1000),
    startDate: payload.startDate,
    endDate: payload.endDate,
    notes: text(payload.notes, 2000)
  };
  const errors = {};
  if (!value.name) errors.name = 'Name is required and must be 100 characters or fewer';
  if (value.goal === null) errors.goal = 'Goal must be 1000 characters or fewer';
  if (value.notes === null) errors.notes = 'Notes must be 2000 characters or fewer';
  validateDateRange(value.startDate, value.endDate, errors);
  return Object.keys(errors).length > 0 ? { errors } : { value };
}

function validatePhasePayload(payload = {}) {
  const value = {
    name: text(payload.name, 100),
    startDate: payload.startDate,
    endDate: payload.endDate,
    description: text(payload.description, 2000),
    adjustmentReason: text(payload.adjustmentReason, 1000),
    status: payload.status || 'planned'
  };
  const errors = {};
  if (!value.name) errors.name = 'Name is required and must be 100 characters or fewer';
  if (value.description === null) errors.description = 'Description must be 2000 characters or fewer';
  if (value.adjustmentReason === null) errors.adjustmentReason = 'Adjustment reason must be 1000 characters or fewer';
  if (!PHASE_STATUSES.has(value.status)) errors.status = 'Invalid phase status';
  validateDateRange(value.startDate, value.endDate, errors);
  return Object.keys(errors).length > 0 ? { errors } : { value };
}

function validateTargets(targets) {
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) return null;
  const normalized = {};
  if (targets.duration != null && targets.durationSeconds != null) return null;
  for (const [metric, rawValue] of Object.entries(targets)) {
    const number = Number(rawValue);
    if (!isTrainingMetric(metric) || !Number.isFinite(number) || number <= 0) return null;
    if (metric === 'durationSeconds' && !Number.isInteger(number)) return null;
    normalized[metric] = number;
  }
  return normalized;
}

function validateSessionPayload(payload = {}) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const value = {
    scheduledDate: payload.scheduledDate,
    sequence: payload.sequence == null ? 1 : Number(payload.sequence),
    name: text(payload.name, 100),
    notes: text(payload.notes, 2000),
    status: payload.status || 'planned',
    items: []
  };
  const errors = {};
  if (!isValidDate(value.scheduledDate)) errors.scheduledDate = 'Use a valid YYYY-MM-DD date';
  if (!Number.isInteger(value.sequence) || value.sequence < 1) errors.sequence = 'Sequence must be a positive integer';
  if (value.name === null) errors.name = 'Name must be 100 characters or fewer';
  if (value.notes === null) errors.notes = 'Notes must be 2000 characters or fewer';
  if (!SESSION_STATUSES.has(value.status)) errors.status = 'Invalid training session status';
  if (items.length === 0) errors.items = 'Add at least one training exercise';

  const exerciseIds = new Set();
  items.forEach((item, index) => {
    const exerciseId = Number(item?.exerciseId);
    const targets = validateTargets(item?.targets || {});
    if (!Number.isInteger(exerciseId) || exerciseId < 1 || exerciseIds.has(exerciseId)) {
      errors[`items.${index}.exerciseId`] = 'Select each exercise once';
    }
    if (targets === null) errors[`items.${index}.targets`] = 'Targets must contain positive supported metric values';
    exerciseIds.add(exerciseId);
    value.items.push({ exerciseId, targets: targets || {} });
  });

  return Object.keys(errors).length > 0 ? { errors } : { value };
}

function validatePhaseReviewPayload(payload = {}) {
  const rawFatigue = payload.fatigueLevel;
  const rawWeightChange = payload.weightChange;
  const fatigueLevel = rawFatigue === '' || rawFatigue == null ? null : Number(rawFatigue);
  const weightChange = rawWeightChange === '' || rawWeightChange == null ? null : Number(rawWeightChange);
  const value = {
    summary: text(payload.summary, 4000),
    fatigueLevel,
    discomfort: text(payload.discomfort, 2000),
    weightChange,
    adjustment: text(payload.adjustment, 2000)
  };
  const errors = {};
  if (value.summary === null) errors.summary = 'Summary must be 4000 characters or fewer';
  if (value.discomfort === null) errors.discomfort = 'Discomfort must be 2000 characters or fewer';
  if (value.adjustment === null) errors.adjustment = 'Adjustment must be 2000 characters or fewer';
  if (
    fatigueLevel !== null &&
    (!Number.isInteger(fatigueLevel) || fatigueLevel < 0 || fatigueLevel > MAX_FATIGUE_LEVEL)
  ) {
    errors.fatigueLevel = 'Fatigue level must be an integer from 0 to 10';
  }
  if (fatigueLevel !== null && fatigueLevel > 6) {
    if (!value.discomfort) errors.discomfort = 'Discomfort is required above fatigue level 6';
    if (!value.adjustment) errors.adjustment = 'Adjustment is required above fatigue level 6';
  }
  if (weightChange !== null && (!Number.isFinite(weightChange) || weightChange < -100 || weightChange > 100)) {
    errors.weightChange = 'Weight change must be between -100 and 100';
  }
  return Object.keys(errors).length > 0 ? { errors } : { value };
}

function serializePlan(row, { today = todayDateKey(), stats = null } = {}) {
  return {
    id: Number(row.id),
    name: row.name,
    goal: row.goal || '',
    startDate: row.start_date,
    endDate: row.end_date,
    // 生命周期由日期推导，归档是独立的意图位，两者都不落库。
    // 原来那个把"进行中/已完成/已归档"混在一起的 status 枚举已经在迁移 v10 删除。
    ...resolvePlanLifecycle({ startDate: row.start_date, endDate: row.end_date, archivedAt: row.archived_at }, today),
    notes: row.notes || '',
    phaseCount: row.phase_count == null ? undefined : Number(row.phase_count),
    sessionCount: row.session_count == null ? undefined : Number(row.session_count),
    trainingDayCount: row.training_day_count == null ? undefined : Number(row.training_day_count),
    adherence: stats?.adherence ?? summarizePlanAdherence(),
    phaseName: row.phase_name || '',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function serializePhase(row) {
  const executionSummary = getPhaseExecutionSummary(Number(row.id), Number(row.plan_id), row.start_date, row.end_date);
  return {
    id: Number(row.id),
    planId: Number(row.plan_id),
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    description: row.description || '',
    adjustmentReason: row.adjustment_reason || '',
    status: row.status,
    position: Number(row.position),
    review: serializePhaseReview(queryRow('SELECT * FROM training_phase_reviews WHERE phase_id = ?', [row.id])),
    executionSummary,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function serializePhaseReview(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    phaseId: Number(row.phase_id),
    summary: row.summary || '',
    fatigueLevel: row.fatigue_level == null ? null : Number(row.fatigue_level),
    discomfort: row.discomfort || '',
    weightChange: row.weight_change == null ? null : Number(row.weight_change),
    adjustment: row.adjustment || '',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function getPhaseExecutionSummary(phaseId, planId, startDate, endDate) {
  if (!phaseId || !planId || !startDate || !endDate) {
    return { total: 0, achieved: 0, partial: 0, noData: 0, unverifiable: 0, planned: 0, skipped: 0 };
  }
  const row = queryRow(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'achieved' THEN 1 ELSE 0 END) AS achieved,
       SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial,
       SUM(CASE WHEN status = 'no_data' THEN 1 ELSE 0 END) AS no_data,
       SUM(CASE WHEN status = 'unverifiable' THEN 1 ELSE 0 END) AS unverifiable,
       SUM(CASE WHEN status = 'planned' THEN 1 ELSE 0 END) AS planned,
       SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped
     FROM training_sessions
     WHERE plan_id = ? AND scheduled_date >= ? AND scheduled_date <= ?`,
    [planId, startDate, endDate]
  );
  return {
    total: Number(row?.total || 0),
    achieved: Number(row?.achieved || 0),
    partial: Number(row?.partial || 0),
    noData: Number(row?.no_data || 0),
    unverifiable: Number(row?.unverifiable || 0),
    planned: Number(row?.planned || 0),
    skipped: Number(row?.skipped || 0)
  };
}

function serializeSession(row, derivedStatus = '') {
  const executionStatus = row.execution_status || '';
  const itemCount = Number(row.session_item_count ?? row.item_count ?? 0);
  const loggedItemCount = Number(row.logged_item_count ?? 0);
  return {
    id: Number(row.id),
    planId: Number(row.plan_id),
    scheduledDate: row.scheduled_date,
    sequence: Number(row.sequence),
    name: row.name || '',
    notes: row.notes || '',
    // 调用方（训练单元列表）已经按有氧匹配算过状态时用它的，否则退回只看执行记录的口径。
    status: derivedStatus || effectiveSessionStatus(row.status, executionStatus, itemCount, loggedItemCount),
    plannedStatus: row.status,
    execution: executionStatus
      ? {
          id: Number(row.execution_id),
          status: executionStatus,
          source: row.execution_source,
          completedAt: row.execution_completed_at == null ? null : Number(row.execution_completed_at),
          sessionFeel: row.execution_session_feel || null,
          discomfort: row.execution_discomfort || '',
          note: row.execution_note || ''
        }
      : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function serializeSessionListItem(row, derivedStatus = '') {
  return {
    ...serializeSession(row, derivedStatus),
    planName: row.plan_name,
    itemCount: Number(row.item_count),
    exercises: parseJson(row.exercises, [])
  };
}

function serializeItem(row) {
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id),
    exerciseId: Number(row.exercise_id),
    position: Number(row.position),
    verificationMode: row.verification_mode,
    targets: parseJson(row.targets, {}),
    exercise: {
      name: row.exercise_name,
      icon: row.exercise_icon,
      category: row.exercise_category,
      metrics: parseJson(row.exercise_metrics, []),
      sportTypes: parseJson(row.exercise_sport_types, [])
    },
    match: null,
    execution: row.log_item_id
      ? {
          status: row.log_item_status,
          actuals: parseJson(row.log_item_actuals, {}),
          skipReason: row.log_item_skip_reason || '',
          note: row.log_item_note || ''
        }
      : null
  };
}

function effectiveSessionStatus(plannedStatus, executionStatus, itemCount = 0, loggedItemCount = 0) {
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
function deriveSessionStatus({
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
function deriveStatusForSession(session, sessionItems, matches, today) {
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
function completionStatusOf(status, scheduledDate, today) {
  return status === 'planned' && scheduledDate && scheduledDate < today ? 'missed' : status;
}

/**
 * 评估一批训练单元的自动验证项目。
 * @param {Array<object>} itemRows 训练项目行，需带 scheduled_date、verification_mode、targets、exercise_sport_types
 * @param {Array<object>} records 归一后的导入运动记录
 * @param {string} today 今天的日期
 * @returns {Map<number, object>} 训练项目 id → 匹配结果
 */
function evaluateAutoMatches(itemRows, records, today) {
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
function computePlanStats(planIds, today, preloadedRecords = null) {
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

/** 只取计划行，给存在性校验这类不需要统计的地方用，避免白算一遍达成度。 */
function getPlanRow(id) {
  return queryRow('SELECT * FROM training_plans WHERE id = ?', [id]);
}

/** 带生命周期和达成度的计划响应；列表和详情之外的写操作回应都用这个。 */
function getPlan(id, today = todayDateKey()) {
  const row = getPlanRow(id);
  return row ? serializePlan(row, { today, stats: computePlanStats([Number(id)], today).get(Number(id)) }) : null;
}

function getPhase(id) {
  const row = queryRow('SELECT * FROM training_phases WHERE id = ?', [id]);
  return row ? serializePhase(row) : null;
}

function getSession(id) {
  const row = queryRow('SELECT * FROM training_sessions WHERE id = ?', [id]);
  return row ? serializeSession(row) : null;
}

function validatePhaseWithinPlan(phase, plan) {
  return phase.startDate >= plan.startDate && phase.endDate <= plan.endDate;
}

function validateExercises(items) {
  const ids = items.map((item) => item.exerciseId);
  const placeholders = ids.map(() => '?').join(', ');
  const rows = queryRows(
    `SELECT id, verification_mode, metrics FROM training_exercises WHERE id IN (${placeholders})`,
    ids
  );
  if (rows.length !== ids.length) return { error: 'One or more training exercises do not exist' };

  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  for (const item of items) {
    const exercise = byId.get(item.exerciseId);
    const supportedMetrics = new Set(parseJson(exercise.metrics, []));
    if (Object.keys(item.targets).some((metric) => metric !== 'durationSeconds' && !supportedMetrics.has(metric))) {
      return { error: 'A target uses a metric that is not supported by its exercise' };
    }
    if (Object.prototype.hasOwnProperty.call(item.targets, 'durationSeconds') && !supportedMetrics.has('duration')) {
      return { error: 'A target uses a metric that is not supported by its exercise' };
    }
  }
  return {
    items: items.map((item) => ({ ...item, verificationMode: byId.get(item.exerciseId).verification_mode }))
  };
}

function respondConflict(res, code, message) {
  return res.status(409).json({ code, message });
}

export function listTrainingPlans(req, res) {
  try {
    // 归档的计划默认不出现在列表里：归档是"我不想再看到它了"这一个意图。
    const includeArchived = String(req.query?.includeArchived ?? '') === 'true';
    const today = todayDateKey();
    const rows = queryRows(
      `
      SELECT p.*,
        COUNT(DISTINCT ph.id) AS phase_count,
        COUNT(DISTINCT s.id) AS session_count,
        COUNT(DISTINCT s.scheduled_date) AS training_day_count,
        (
          SELECT phase.name
          FROM training_phases phase
          WHERE phase.plan_id = p.id
          ORDER BY
            CASE
              WHEN ? BETWEEN phase.start_date AND phase.end_date THEN 0
              WHEN phase.start_date > ? THEN 1
              ELSE 2
            END,
            phase.position,
            phase.start_date,
            phase.id
          LIMIT 1
        ) AS phase_name
      FROM training_plans p
      LEFT JOIN training_phases ph ON ph.plan_id = p.id
      LEFT JOIN training_sessions s ON s.plan_id = p.id
      ${includeArchived ? '' : 'WHERE p.archived_at IS NULL'}
      GROUP BY p.id
    `,
      [today, today]
    );
    // 训练单元状态里包含了有氧自动匹配的结果，只在读取时计算，所以列表页要单独汇总一次。
    const stats = computePlanStats(
      rows.map((row) => Number(row.id)),
      today
    );
    const plans = rows.map((row) => {
      const plan = serializePlan(row, { today, stats: stats.get(Number(row.id)) });
      return {
        ...plan,
        coverage: stats.get(Number(row.id))?.coverage || summarizeCoverage([])
      };
    });
    // 排序也按推导出来的生命周期走，避免把同一套规则在 SQL 和 JS 里各写一份。
    const lifecycleRank = { active: 0, draft: 1, ended: 2 };
    plans.sort((left, right) => {
      if (left.archived !== right.archived) return left.archived ? 1 : -1;
      const byLifecycle = lifecycleRank[left.lifecycle] - lifecycleRank[right.lifecycle];
      if (byLifecycle !== 0) return byLifecycle;
      if (left.startDate !== right.startDate) return left.startDate < right.startDate ? 1 : -1;
      return right.id - left.id;
    });
    return res.json({ plans });
  } catch (error) {
    console.error('Error listing training plans:', error);
    return res.status(500).json({ error: 'Failed to fetch training plans' });
  }
}

export function listTrainingSessions(req, res) {
  try {
    const { startDate, endDate, planId, status } = req.query;
    const page = Number.isInteger(Number(req.query.page)) && Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const pageSize =
      Number.isInteger(Number(req.query.pageSize)) && Number(req.query.pageSize) > 0
        ? Math.min(Number(req.query.pageSize), 100)
        : 10;
    const conditions = [];
    const params = [];
    if (isValidDate(startDate)) {
      conditions.push('s.scheduled_date >= ?');
      params.push(startDate);
    }
    if (isValidDate(endDate)) {
      conditions.push('s.scheduled_date <= ?');
      params.push(endDate);
    }
    if (Number.isInteger(Number(planId)) && Number(planId) > 0) {
      conditions.push('p.id = ?');
      params.push(Number(planId));
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const today = todayDateKey();
    // 状态里含读取时才算的有氧匹配结果，SQL 筛不出来，所以按日期和计划取出候选行，
    // 派生完状态再过滤和分页；不能让 SQL 先分页，否则筛选结果和 total 都会对不上。
    const rows = queryRows(
      `SELECT s.*, p.name AS plan_name,
        log.id AS execution_id,
        log.status AS execution_status,
        log.source AS execution_source,
        log.completed_at AS execution_completed_at,
        log.session_feel AS execution_session_feel,
        log.discomfort AS execution_discomfort,
        log.note AS execution_note,
        (SELECT COUNT(*) FROM training_session_items item_count WHERE item_count.session_id = s.id) AS item_count,
        (SELECT COUNT(*) FROM training_session_log_items logged_item
          JOIN training_session_logs logged_log ON logged_log.id = logged_item.session_log_id
          WHERE logged_log.session_id = s.id) AS logged_item_count,
        (SELECT COALESCE(json_group_array(json_object('name', exercise.name, 'targets', json(item.targets))), '[]')
          FROM training_session_items item
          JOIN training_exercises exercise ON exercise.id = item.exercise_id
          WHERE item.session_id = s.id) AS exercises
       FROM training_sessions s
       JOIN training_plans p ON p.id = s.plan_id
       LEFT JOIN training_session_logs log ON log.session_id = s.id
       ${whereClause}
       ORDER BY s.scheduled_date DESC, s.sequence ASC, s.id DESC`,
      params
    );

    const statuses = deriveSessionListStatuses(rows, today, whereClause, params);
    const filtered = SESSION_COMPLETION_STATUSES.has(status)
      ? rows.filter((row) => statuses.get(Number(row.id)) === status)
      : rows;
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
    return res.json({
      sessions: pageRows.map((row) => serializeSessionListItem(row, statuses.get(Number(row.id)))),
      total: filtered.length,
      page,
      pageSize
    });
  } catch (error) {
    console.error('Error listing training sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch training sessions' });
  }
}

/**
 * 批量推导训练单元列表里每一行的完成状态。
 * 有氧匹配依赖导入的运动记录，只能读取时算；项目行用同一套筛选条件和训练单元一起取出，
 * 避免按 id 列表拼一条可能超过 SQLite 参数上限的 IN 查询。
 * @param {Array<object>} sessionRows 候选训练单元行
 * @param {string} today 今天的日期
 * @param {string} whereClause 列表的筛选条件（引用 s.scheduled_date 和 p.id）
 * @param {Array<*>} params whereClause 的参数
 * @returns {Map<number, string>} 训练单元 id → 展示状态（含未完成）
 */
function deriveSessionListStatuses(sessionRows, today, whereClause, params) {
  const statuses = new Map();
  if (sessionRows.length === 0) return statuses;
  const itemRows = queryRows(
    `SELECT i.id, i.session_id, i.verification_mode, i.targets,
       s.scheduled_date AS scheduled_date,
       e.sport_types AS exercise_sport_types,
       (SELECT COUNT(*) FROM training_session_log_items item_log
          JOIN training_session_logs item_log_head ON item_log_head.id = item_log.session_log_id
          WHERE item_log.session_item_id = i.id) AS item_log_count
     FROM training_session_items i
     JOIN training_exercises e ON e.id = i.exercise_id
     JOIN training_sessions s ON s.id = i.session_id
     JOIN training_plans p ON p.id = s.plan_id
     ${whereClause}`,
    params
  );
  const dateKeys = sessionRows
    .map((row) => row.scheduled_date)
    .filter(Boolean)
    .sort();
  const records = loadNormalizedSportRecords(dateKeys[0], dateKeys.at(-1));
  const matches = evaluateAutoMatches(itemRows, records, today);
  const itemsBySession = Map.groupBy(itemRows, (row) => Number(row.session_id));
  for (const session of sessionRows) {
    const { status } = deriveStatusForSession(session, itemsBySession.get(Number(session.id)) || [], matches, today);
    statuses.set(Number(session.id), completionStatusOf(status, session.scheduled_date, today));
  }
  return statuses;
}

export function getTrainingPlan(req, res) {
  try {
    const today = todayDateKey();
    const planId = Number(req.params.id);
    const row = getPlanRow(planId);
    if (!row) return res.status(404).json({ error: 'Training plan not found' });
    // 详情页只需要一个计划的区间，先读一次导入记录，达成度统计和项目匹配共用同一份，
    // 避免在同一个请求里把最重的那条查询跑两遍。
    const sportRecords = loadNormalizedSportRecords(row.start_date, row.end_date);
    const stats = computePlanStats([planId], today, sportRecords).get(planId);
    const plan = serializePlan(row, { today, stats });
    const phases = queryRows('SELECT * FROM training_phases WHERE plan_id = ? ORDER BY position, start_date, id', [
      plan.id
    ]).map(serializePhase);
    const sessions = queryRows(
      `SELECT s.*,
        log.id AS execution_id,
        log.status AS execution_status,
        log.source AS execution_source,
        log.completed_at AS execution_completed_at,
        log.session_feel AS execution_session_feel,
        log.discomfort AS execution_discomfort,
        log.note AS execution_note,
        (SELECT COUNT(*) FROM training_session_items item_count WHERE item_count.session_id = s.id) AS session_item_count,
        (SELECT COUNT(*) FROM training_session_log_items logged_item
          JOIN training_session_logs logged_log ON logged_log.id = logged_item.session_log_id
          WHERE logged_log.session_id = s.id) AS logged_item_count
       FROM training_sessions s
       LEFT JOIN training_session_logs log ON log.session_id = s.id
       WHERE s.plan_id = ?
       ORDER BY s.scheduled_date, s.sequence, s.id`,
      [plan.id]
    ).map(serializeSession);
    const sessionIds = sessions.map((session) => session.id);
    const itemRows =
      sessionIds.length === 0
        ? []
        : queryRows(
            `SELECT i.*, e.name AS exercise_name, e.icon AS exercise_icon,
              e.category AS exercise_category, e.metrics AS exercise_metrics,
              e.sport_types AS exercise_sport_types,
              s.scheduled_date AS scheduled_date,
              log_item.id AS log_item_id,
              log_item.status AS log_item_status,
              log_item.actuals AS log_item_actuals,
              log_item.skip_reason AS log_item_skip_reason,
              log_item.note AS log_item_note
             FROM training_session_items i
             JOIN training_exercises e ON e.id = i.exercise_id
             JOIN training_sessions s ON s.id = i.session_id
             LEFT JOIN training_session_logs log ON log.session_id = i.session_id
             LEFT JOIN training_session_log_items log_item
              ON log_item.session_log_id = log.id AND log_item.session_item_id = i.id
             WHERE i.session_id IN (${sessionIds.map(() => '?').join(', ')})
             ORDER BY i.position, i.id`,
            sessionIds
          );

    const matches = evaluateAutoMatches(itemRows, sportRecords, today);
    const items = itemRows.map((row) => {
      const item = serializeItem(row);
      const match = matches.get(item.id);
      return match ? { ...item, match } : item;
    });

    const itemsBySession = Map.groupBy(items, (item) => item.sessionId);
    const resolvedSessions = sessions.map((session) => {
      const sessionItems = itemsBySession.get(session.id) || [];
      const manualItems = sessionItems.filter((item) => item.verificationMode === 'manual');
      const autoMatches = sessionItems
        .filter((item) => item.verificationMode !== 'manual' && item.match)
        .map((item) => item.match);
      return {
        ...session,
        items: sessionItems,
        status: deriveSessionStatus({
          plannedStatus: session.plannedStatus,
          scheduledDate: session.scheduledDate,
          today,
          executionStatus: session.execution?.status || '',
          itemCount: sessionItems.length,
          loggedItemCount: sessionItems.filter((item) => item.execution).length,
          manualItemCount: manualItems.length,
          pendingManualItemCount: manualItems.filter((item) => !item.execution).length,
          autoMatches
        }),
        autoSummary: summarizeItemResults(autoMatches)
      };
    });

    return res.json({
      ...plan,
      phases,
      coverage: stats?.coverage || summarizeCoverage([]),
      // 加练日推不出来（它落在没有训练单元的日子上），单独返回，让详情页能解释比率为什么超过 100%。
      extraTrainingDates: stats?.extraDates || [],
      sessions: resolvedSessions
    });
  } catch (error) {
    console.error('Error getting training plan:', error);
    return res.status(500).json({ error: 'Failed to fetch training plan' });
  }
}

export function createTrainingPlan(req, res) {
  const validation = validatePlanPayload(req.body);
  if (validation.errors) return res.status(400).json({ error: 'Invalid training plan', fields: validation.errors });
  try {
    const now = Date.now();
    const value = validation.value;
    databaseService.getDb().run(
      `INSERT INTO training_plans (name, goal, start_date, end_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [value.name, value.goal, value.startDate, value.endDate, value.notes, now, now]
    );
    const id = Number(queryRow('SELECT last_insert_rowid() AS id').id);
    return res.status(201).json(getPlan(id));
  } catch (error) {
    console.error('Error creating training plan:', error);
    return res.status(500).json({ error: 'Failed to create training plan' });
  }
}

export function createTrainingPlanWithSessions(req, res) {
  const planValidation = validatePlanPayload(req.body?.plan);
  if (planValidation.errors) {
    return res.status(400).json({ error: 'Invalid training plan', fields: { plan: planValidation.errors } });
  }

  const rawSessions = Array.isArray(req.body?.sessions) ? req.body.sessions : [];
  const sessionValues = [];
  const fields = {};
  const sessionSlots = new Set();
  rawSessions.forEach((session, index) => {
    const sessionValidation = validateSessionPayload(session);
    if (sessionValidation.errors) {
      Object.entries(sessionValidation.errors).forEach(([field, message]) => {
        fields[`sessions.${index}.${field}`] = message;
      });
      return;
    }

    const value = sessionValidation.value;
    if (value.scheduledDate < planValidation.value.startDate || value.scheduledDate > planValidation.value.endDate) {
      fields[`sessions.${index}.scheduledDate`] = 'Training session date must be within the plan';
      return;
    }
    const slot = `${value.scheduledDate}:${value.sequence}`;
    if (sessionSlots.has(slot)) {
      fields[`sessions.${index}.scheduledDate`] = 'Only one training session is allowed for this date';
      return;
    }
    sessionSlots.add(slot);
    sessionValues.push(value);
  });

  if (Object.keys(fields).length > 0) {
    return res.status(400).json({ error: 'Invalid training sessions', fields });
  }

  const exerciseValues = [];
  for (const [index, session] of sessionValues.entries()) {
    const exerciseValidation = validateExercises(session.items);
    if (exerciseValidation.error) {
      return res.status(400).json({
        error: 'Invalid training sessions',
        fields: { [`sessions.${index}.items`]: exerciseValidation.error }
      });
    }
    exerciseValues.push(exerciseValidation.items);
  }

  const db = databaseService.getDb();
  let transactionOpen = false;
  try {
    const now = Date.now();
    const plan = planValidation.value;
    db.run('BEGIN IMMEDIATE');
    transactionOpen = true;
    db.run(
      `INSERT INTO training_plans (name, goal, start_date, end_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [plan.name, plan.goal, plan.startDate, plan.endDate, plan.notes, now, now]
    );
    const planId = Number(queryRow('SELECT last_insert_rowid() AS id').id);

    sessionValues.forEach((session, index) => {
      db.run(
        `INSERT INTO training_sessions
          (plan_id, scheduled_date, sequence, name, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planId, session.scheduledDate, session.sequence, session.name, session.notes, session.status, now, now]
      );
      const sessionId = Number(queryRow('SELECT last_insert_rowid() AS id').id);
      saveSessionItems(db, sessionId, exerciseValues[index], now);
    });

    db.run('COMMIT');
    transactionOpen = false;
    return res.status(201).json(getPlan(planId));
  } catch (error) {
    if (transactionOpen) db.run('ROLLBACK');
    console.error('Error creating training plan with sessions:', error);
    return res.status(500).json({ error: 'Failed to create training plan' });
  }
}

export function updateTrainingPlan(req, res) {
  const validation = validatePlanPayload(req.body);
  if (validation.errors) return res.status(400).json({ error: 'Invalid training plan', fields: validation.errors });
  try {
    const id = Number(req.params.id);
    const existing = getPlanRow(id);
    if (!existing) return res.status(404).json({ error: 'Training plan not found' });
    const value = validation.value;

    // 计划一旦开始就不能停止：已开始的计划只能延长。
    // 缩短结束日期等于变相提前结束，要提前结束就用阶段级手段（取消阶段或删掉后续训练单元），
    // 要整体放弃就用归档。见 docs/todos/training-plan.md 的「计划的两个维度」。
    if (todayDateKey() >= existing.start_date && value.endDate < existing.end_date) {
      return respondConflict(
        res,
        'PLAN_END_DATE_CANNOT_SHRINK',
        'A started plan can only be extended; archive it or cancel phases to stop early'
      );
    }

    const outsidePhase = queryRow(
      'SELECT id FROM training_phases WHERE plan_id = ? AND (start_date < ? OR end_date > ?) LIMIT 1',
      [id, value.startDate, value.endDate]
    );
    if (outsidePhase)
      return respondConflict(res, 'PLAN_DATES_EXCLUDE_PHASES', 'Plan dates must include all existing phases');
    const outsideSession = queryRow(
      'SELECT id FROM training_sessions WHERE plan_id = ? AND (scheduled_date < ? OR scheduled_date > ?) LIMIT 1',
      [id, value.startDate, value.endDate]
    );
    if (outsideSession)
      return respondConflict(
        res,
        'PLAN_DATES_EXCLUDE_SESSIONS',
        'Plan dates must include all existing training sessions'
      );
    databaseService.getDb().run(
      `UPDATE training_plans SET name = ?, goal = ?, start_date = ?, end_date = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [value.name, value.goal, value.startDate, value.endDate, value.notes, Date.now(), id]
    );
    return res.json(getPlan(id));
  } catch (error) {
    console.error('Error updating training plan:', error);
    return res.status(500).json({ error: 'Failed to update training plan' });
  }
}

/**
 * 归档或取消归档。归档是唯一推不出来的计划意图，所以它是独立的一个位，
 * 而不是生命周期的一个取值：可以归档一个进行中的计划（放弃），它仍然是进行中。
 */
export function updateTrainingPlanArchived(req, res) {
  const archived = req.body?.archived;
  if (typeof archived !== 'boolean') {
    return res.status(400).json({
      error: 'Invalid training plan',
      fields: { archived: 'archived must be a boolean' }
    });
  }
  try {
    const id = Number(req.params.id);
    if (!getPlanRow(id)) return res.status(404).json({ error: 'Training plan not found' });
    const now = Date.now();
    databaseService
      .getDb()
      .run('UPDATE training_plans SET archived_at = ?, updated_at = ? WHERE id = ?', [archived ? now : null, now, id]);
    return res.json(getPlan(id));
  } catch (error) {
    console.error('Error updating training plan archived state:', error);
    return res.status(500).json({ error: 'Failed to update training plan' });
  }
}

export function deleteTrainingPlan(req, res) {
  try {
    const id = Number(req.params.id);
    if (!getPlan(id)) return res.status(404).json({ error: 'Training plan not found' });
    // Foreign-key cascades remove phases, training sessions, and their items atomically.
    databaseService.getDb().run('DELETE FROM training_plans WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting training plan:', error);
    return res.status(500).json({ error: 'Failed to delete training plan' });
  }
}

export function createTrainingPhase(req, res) {
  const validation = validatePhasePayload(req.body);
  if (validation.errors) return res.status(400).json({ error: 'Invalid training phase', fields: validation.errors });
  try {
    const planId = Number(req.params.planId);
    const plan = getPlan(planId);
    if (!plan) return res.status(404).json({ error: 'Training plan not found' });
    if (!validatePhaseWithinPlan(validation.value, plan)) {
      return respondConflict(res, 'PHASE_OUTSIDE_PLAN', 'Phase dates must be within the training plan');
    }
    const { nextPosition = 0 } = queryRow(
      'SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition FROM training_phases WHERE plan_id = ?',
      [planId]
    );
    const value = validation.value;
    const now = Date.now();
    databaseService.getDb().run(
      `INSERT INTO training_phases
        (plan_id, name, start_date, end_date, description, adjustment_reason, status, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        value.name,
        value.startDate,
        value.endDate,
        value.description,
        value.adjustmentReason,
        value.status,
        Number(nextPosition),
        now,
        now
      ]
    );
    const id = Number(queryRow('SELECT last_insert_rowid() AS id').id);
    return res.status(201).json(getPhase(id));
  } catch (error) {
    console.error('Error creating training phase:', error);
    return res.status(500).json({ error: 'Failed to create training phase' });
  }
}

export function updateTrainingPhase(req, res) {
  const validation = validatePhasePayload(req.body);
  if (validation.errors) return res.status(400).json({ error: 'Invalid training phase', fields: validation.errors });
  try {
    const id = Number(req.params.id);
    const phase = getPhase(id);
    if (!phase) return res.status(404).json({ error: 'Training phase not found' });
    const plan = getPlan(phase.planId);
    if (!validatePhaseWithinPlan(validation.value, plan)) {
      return respondConflict(res, 'PHASE_OUTSIDE_PLAN', 'Phase dates must be within the training plan');
    }
    const value = validation.value;
    databaseService.getDb().run(
      `UPDATE training_phases SET name = ?, start_date = ?, end_date = ?, description = ?,
        adjustment_reason = ?, status = ?, updated_at = ? WHERE id = ?`,
      [
        value.name,
        value.startDate,
        value.endDate,
        value.description,
        value.adjustmentReason,
        value.status,
        Date.now(),
        id
      ]
    );
    return res.json(getPhase(id));
  } catch (error) {
    console.error('Error updating training phase:', error);
    return res.status(500).json({ error: 'Failed to update training phase' });
  }
}

export function getTrainingPhaseReview(req, res) {
  try {
    const phase = getPhase(Number(req.params.id));
    if (!phase) return res.status(404).json({ error: 'Training phase not found' });
    return res.json({
      phaseId: phase.id,
      review: phase.review,
      executionSummary: phase.executionSummary
    });
  } catch (error) {
    console.error('Error getting training phase review:', error);
    return res.status(500).json({ error: 'Failed to fetch training phase review' });
  }
}

export function saveTrainingPhaseReview(req, res) {
  const validation = validatePhaseReviewPayload(req.body);
  if (validation.errors) {
    return res.status(400).json({ error: 'Invalid training phase review', fields: validation.errors });
  }
  try {
    const phase = getPhase(Number(req.params.id));
    if (!phase) return res.status(404).json({ error: 'Training phase not found' });
    const value = validation.value;
    const now = Date.now();
    databaseService.getDb().run(
      `INSERT INTO training_phase_reviews
        (phase_id, summary, fatigue_level, discomfort, weight_change, adjustment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(phase_id) DO UPDATE SET
         summary = excluded.summary,
         fatigue_level = excluded.fatigue_level,
         discomfort = excluded.discomfort,
         weight_change = excluded.weight_change,
         adjustment = excluded.adjustment,
         updated_at = excluded.updated_at`,
      [phase.id, value.summary, value.fatigueLevel, value.discomfort, value.weightChange, value.adjustment, now, now]
    );
    const review = serializePhaseReview(
      queryRow('SELECT * FROM training_phase_reviews WHERE phase_id = ?', [phase.id])
    );
    return res.json({
      phaseId: phase.id,
      review,
      executionSummary: getPhaseExecutionSummary(phase.id, phase.planId, phase.startDate, phase.endDate)
    });
  } catch (error) {
    console.error('Error saving training phase review:', error);
    return res.status(500).json({ error: 'Failed to save training phase review' });
  }
}

function saveSessionItems(db, sessionId, items, now, startPosition = 0) {
  items.forEach((item, index) => {
    db.run(
      `INSERT INTO training_session_items
        (session_id, exercise_id, position, verification_mode, targets, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, item.exerciseId, startPosition + index, item.verificationMode, JSON.stringify(item.targets), now, now]
    );
  });
}

function appendSessionItems(db, sessionId, items, now) {
  if (items.length === 0) return;
  const row = queryRow(
    'SELECT COALESCE(MAX(position), -1) AS max_position FROM training_session_items WHERE session_id = ?',
    [sessionId]
  );
  saveSessionItems(db, sessionId, items, now, Number(row?.max_position ?? -1) + 1);
}

export function createTrainingSession(req, res) {
  const validation = validateSessionPayload(req.body);
  if (validation.errors) return res.status(400).json({ error: 'Invalid training session', fields: validation.errors });
  const db = databaseService.getDb();
  let transactionOpen = false;
  try {
    const plan = getPlan(Number(req.params.planId));
    if (!plan) return res.status(404).json({ error: 'Training plan not found' });
    const value = validation.value;
    if (value.scheduledDate < plan.startDate || value.scheduledDate > plan.endDate) {
      return respondConflict(res, 'SESSION_OUTSIDE_PLAN', 'Training session date must be within the plan');
    }
    const exerciseValidation = validateExercises(value.items);
    if (exerciseValidation.error) return res.status(400).json({ error: exerciseValidation.error });
    const duplicate = queryRow(
      'SELECT id FROM training_sessions WHERE plan_id = ? AND scheduled_date = ? AND sequence = ?',
      [plan.id, value.scheduledDate, value.sequence]
    );
    if (duplicate)
      return respondConflict(res, 'SESSION_DATE_EXISTS', 'A training session already exists for this date');

    const now = Date.now();
    db.run('BEGIN IMMEDIATE');
    transactionOpen = true;
    db.run(
      `INSERT INTO training_sessions
        (plan_id, scheduled_date, sequence, name, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [plan.id, value.scheduledDate, value.sequence, value.name, value.notes, value.status, now, now]
    );
    const id = Number(queryRow('SELECT last_insert_rowid() AS id').id);
    saveSessionItems(db, id, exerciseValidation.items, now);
    db.run('COMMIT');
    transactionOpen = false;
    return res.status(201).json(getSession(id));
  } catch (error) {
    if (transactionOpen) db.run('ROLLBACK');
    console.error('Error creating training session:', error);
    return res.status(500).json({ error: 'Failed to create training session' });
  }
}

export function createTrainingSessionsBatch(req, res) {
  const planId = Number(req.params.planId);
  const plan = getPlan(planId);
  if (!plan) return res.status(404).json({ error: 'Training plan not found' });

  const rawSessions = Array.isArray(req.body?.sessions) ? req.body.sessions : [];
  if (rawSessions.length === 0) {
    return res.status(400).json({ error: 'Add at least one training session' });
  }

  const sessionValues = [];
  const fields = {};
  const sessionSlots = new Set();
  rawSessions.forEach((session, index) => {
    const validation = validateSessionPayload(session);
    if (validation.errors) {
      Object.entries(validation.errors).forEach(([field, message]) => {
        fields[`sessions.${index}.${field}`] = message;
      });
      return;
    }
    const value = validation.value;
    if (value.scheduledDate < plan.startDate || value.scheduledDate > plan.endDate) {
      fields[`sessions.${index}.scheduledDate`] = 'Training session date must be within the plan';
      return;
    }
    const slot = `${value.scheduledDate}:${value.sequence}`;
    if (sessionSlots.has(slot)) {
      fields[`sessions.${index}.scheduledDate`] = 'Only one training session is allowed for this date';
      return;
    }
    sessionSlots.add(slot);
    sessionValues.push(value);
  });

  if (Object.keys(fields).length > 0) {
    return res.status(400).json({ error: 'Invalid training sessions', fields });
  }

  const exerciseValues = [];
  for (const [index, session] of sessionValues.entries()) {
    const exerciseValidation = validateExercises(session.items);
    if (exerciseValidation.error) {
      return res.status(400).json({
        error: 'Invalid training sessions',
        fields: { [`sessions.${index}.items`]: exerciseValidation.error }
      });
    }
    exerciseValues.push(exerciseValidation.items);
  }

  const existing = queryRows(
    `SELECT id, scheduled_date, sequence FROM training_sessions
     WHERE plan_id = ? AND scheduled_date IN (${sessionValues.map(() => '?').join(', ')})`,
    [planId, ...sessionValues.map((session) => session.scheduledDate)]
  );
  const existingBySlot = new Map(existing.map((session) => [`${session.scheduled_date}:${session.sequence}`, session]));

  const db = databaseService.getDb();
  let transactionOpen = false;
  try {
    const now = Date.now();
    db.run('BEGIN IMMEDIATE');
    transactionOpen = true;
    let createdCount = 0;
    let updatedCount = 0;
    let itemCount = 0;
    sessionValues.forEach((session, index) => {
      const existingSession = existingBySlot.get(`${session.scheduledDate}:${session.sequence}`);
      if (existingSession) {
        const existingItems = queryRows(
          'SELECT exercise_id FROM training_session_items WHERE session_id = ? ORDER BY position, id',
          [existingSession.id]
        );
        const existingExerciseIds = new Set(existingItems.map((item) => Number(item.exercise_id)));
        const newItems = exerciseValues[index].filter((item) => !existingExerciseIds.has(item.exerciseId));
        appendSessionItems(db, existingSession.id, newItems, now);
        if (newItems.length > 0) {
          db.run('UPDATE training_sessions SET updated_at = ? WHERE id = ?', [now, existingSession.id]);
          updatedCount += 1;
          itemCount += newItems.length;
        }
        return;
      }
      db.run(
        `INSERT INTO training_sessions
          (plan_id, scheduled_date, sequence, name, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [planId, session.scheduledDate, session.sequence, session.name, session.notes, session.status, now, now]
      );
      const id = Number(queryRow('SELECT last_insert_rowid() AS id').id);
      saveSessionItems(db, id, exerciseValues[index], now);
      createdCount += 1;
      itemCount += exerciseValues[index].length;
    });
    db.run('COMMIT');
    transactionOpen = false;
    return res.status(201).json({
      count: createdCount + updatedCount,
      createdCount,
      updatedCount,
      itemCount,
      plan: getPlan(planId)
    });
  } catch (error) {
    if (transactionOpen) db.run('ROLLBACK');
    console.error('Error creating training sessions in batch:', error);
    return res.status(500).json({ error: 'Failed to create training sessions' });
  }
}

export function updateTrainingSession(req, res) {
  const validation = validateSessionPayload(req.body);
  if (validation.errors) return res.status(400).json({ error: 'Invalid training session', fields: validation.errors });
  const db = databaseService.getDb();
  let transactionOpen = false;
  try {
    const id = Number(req.params.id);
    const session = getSession(id);
    if (!session) return res.status(404).json({ error: 'Training session not found' });
    const plan = getPlan(session.planId);
    if (!plan) return res.status(404).json({ error: 'Training plan not found' });
    const value = validation.value;
    if (value.scheduledDate < plan.startDate || value.scheduledDate > plan.endDate) {
      return respondConflict(res, 'SESSION_OUTSIDE_PLAN', 'Training session date must be within the plan');
    }
    const exerciseValidation = validateExercises(value.items);
    if (exerciseValidation.error) return res.status(400).json({ error: exerciseValidation.error });
    const duplicate = queryRow(
      'SELECT id FROM training_sessions WHERE plan_id = ? AND scheduled_date = ? AND sequence = ? AND id <> ?',
      [plan.id, value.scheduledDate, value.sequence, id]
    );
    if (duplicate)
      return respondConflict(res, 'SESSION_DATE_EXISTS', 'A training session already exists for this date');

    const now = Date.now();
    db.run('BEGIN IMMEDIATE');
    transactionOpen = true;
    db.run(
      `UPDATE training_sessions SET scheduled_date = ?, sequence = ?, name = ?, notes = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [value.scheduledDate, value.sequence, value.name, value.notes, value.status, now, id]
    );
    db.run('DELETE FROM training_session_items WHERE session_id = ?', [id]);
    saveSessionItems(db, id, exerciseValidation.items, now);
    db.run('COMMIT');
    transactionOpen = false;
    return res.json(getSession(id));
  } catch (error) {
    if (transactionOpen) db.run('ROLLBACK');
    console.error('Error updating training session:', error);
    return res.status(500).json({ error: 'Failed to update training session' });
  }
}

export function deleteTrainingPhase(req, res) {
  try {
    const id = Number(req.params.id);
    if (!getPhase(id)) return res.status(404).json({ error: 'Training phase not found' });
    databaseService.getDb().run('DELETE FROM training_phases WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting training phase:', error);
    return res.status(500).json({ error: 'Failed to delete training phase' });
  }
}

export function deleteTrainingSession(req, res) {
  try {
    const id = Number(req.params.id);
    if (!getSession(id)) return res.status(404).json({ error: 'Training session not found' });
    databaseService.getDb().run('DELETE FROM training_sessions WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting training session:', error);
    return res.status(500).json({ error: 'Failed to delete training session' });
  }
}

export const trainingPlanValidation = {
  isValidDate,
  validatePlanPayload,
  validatePhasePayload,
  validateSessionPayload,
  validatePhaseReviewPayload
};
