// 计划领域的数据读写原语：计划/阶段/课次行、课次项目落库、练习存在性与指标校验。
// 控制器和统计模块都从这里取，避免各处重复写同一条 SQL。
import { databaseService } from '../../services/database.js';
import { todayDateKey } from '../../services/sportRecordRepository.js';
import { parseJson, queryRow, queryRows } from './queryHelpers.js';
import { computePlanStats } from './planStats.js';
import { serializePhase, serializePlan, serializeSession } from './serializers.js';

/** 只取计划行，给存在性校验这类不需要统计的地方用，避免白算一遍达成度。 */
export function getPlanRow(id) {
  return queryRow('SELECT * FROM training_plans WHERE id = ?', [id]);
}

/** 带生命周期和达成度的计划响应；列表和详情之外的写操作回应都用这个。 */
export function getPlan(id, today = todayDateKey()) {
  const row = getPlanRow(id);
  return row ? serializePlan(row, { today, stats: computePlanStats([Number(id)], today).get(Number(id)) }) : null;
}

export function getPhase(id) {
  const row = queryRow('SELECT * FROM training_phases WHERE id = ?', [id]);
  return row ? serializePhase(row) : null;
}

export function getSession(id) {
  const row = queryRow('SELECT * FROM training_sessions WHERE id = ?', [id]);
  return row ? serializeSession(row) : null;
}

export function validatePhaseWithinPlan(phase, plan) {
  return phase.startDate >= plan.startDate && phase.endDate <= plan.endDate;
}

export function validateExercises(items) {
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

export function saveSessionItems(db, sessionId, items, now, startPosition = 0) {
  items.forEach((item, index) => {
    db.run(
      `INSERT INTO training_session_items
        (session_id, exercise_id, position, verification_mode, targets, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, item.exerciseId, startPosition + index, item.verificationMode, JSON.stringify(item.targets), now, now]
    );
  });
}

export function appendSessionItems(db, sessionId, items, now) {
  if (items.length === 0) return;
  const row = queryRow(
    'SELECT COALESCE(MAX(position), -1) AS max_position FROM training_session_items WHERE session_id = ?',
    [sessionId]
  );
  saveSessionItems(db, sessionId, items, now, Number(row?.max_position ?? -1) + 1);
}
