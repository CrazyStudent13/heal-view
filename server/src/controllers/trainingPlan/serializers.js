// 计划领域的行 → 响应结构映射。
// 字段名与缺省值是对外契约（列表、详情、课次列表共用），拆分时保持逐字不变。
import { resolvePlanLifecycle, summarizePlanAdherence } from '../../services/planAdherence.js';
import { todayDateKey } from '../../services/sportRecordRepository.js';
import { parseJson, queryRow } from './queryHelpers.js';
import { effectiveSessionStatus } from './sessionStatus.js';

export function serializePlan(row, { today = todayDateKey(), stats = null } = {}) {
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

export function serializePhase(row) {
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

export function serializePhaseReview(row) {
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

export function getPhaseExecutionSummary(phaseId, planId, startDate, endDate) {
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

export function serializeSession(row, derivedStatus = '') {
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

export function serializeSessionListItem(row, derivedStatus = '') {
  return {
    ...serializeSession(row, derivedStatus),
    planName: row.plan_name,
    itemCount: Number(row.item_count),
    exercises: parseJson(row.exercises, [])
  };
}

export function serializeItem(row) {
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
