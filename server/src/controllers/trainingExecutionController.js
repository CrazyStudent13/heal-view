import { databaseService } from '../services/database.js';
import { normalizeActualValue, SKIP_REASONS } from '../utils/trainingMetrics.js';
import { validateDateRange } from '../utils/requestValidation.js';

const MAX_RANGE_DAYS = 62;
const LOG_STATUSES = new Set(['completed', 'partial', 'skipped']);
const ITEM_STATUSES = new Set(['done', 'skipped']);
const SESSION_FEELS = new Set(['easy', 'normal', 'hard']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SKIP_REASON_SET = new Set(SKIP_REASONS);

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
    const parsed = JSON.parse(value);
    return parsed === null ? fallback : parsed;
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

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

function diffInDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

function normalizeSkipReason(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return SKIP_REASON_SET.has(normalized) ? normalized : '';
}

function readHistoryDate(value) {
  const history = parseJson(value, []);
  return Array.isArray(history) && history.length > 0 ? history[0].date || null : null;
}

function readHistoryActuals(value) {
  const history = parseJson(value, []);
  if (!Array.isArray(history) || history.length === 0) return null;
  return parseJson(history[0].actuals, null);
}

/**
 * 把目标与实际记录对照，供移动端和桌面端逐项展示完成度。
 * duration 与 durationSeconds 是两个等价写法，对照时统一折算成秒。
 * @param {Record<string, number>} targets 计划目标
 * @param {Record<string, number|null>} actuals 实际记录
 * @returns {Array<{ metric: string, target: number|null, actual: number|null, ratio: number|null }>} 对照结果
 */
function buildComparisons(targets, actuals) {
  const targetSeconds = targetDurationSeconds(targets || {});
  const actualSeconds = actualDurationSeconds(actuals || {});
  const metrics = new Set([...Object.keys(targets || {}), ...Object.keys(actuals || {})]);
  const skip = new Set(['duration', 'durationSeconds']);

  const comparisons = [...metrics]
    .filter((metric) => !skip.has(metric))
    .map((metric) => {
      const target = targets?.[metric] ?? null;
      const actual = actuals?.[metric] ?? null;
      const ratio =
        actual !== null && Number(target) > 0 ? Math.round((Number(actual) / Number(target)) * 100) / 100 : null;
      return { metric, target, actual, ratio };
    });

  if (targetSeconds > 0 || actualSeconds > 0) {
    comparisons.push({
      metric: 'durationSeconds',
      target: targetSeconds > 0 ? targetSeconds : null,
      actual: actualSeconds > 0 ? actualSeconds : null,
      ratio: actualSeconds > 0 && targetSeconds > 0 ? Math.round((actualSeconds / targetSeconds) * 100) / 100 : null
    });
  }

  return comparisons;
}

function targetDurationSeconds(targets) {
  if (Number(targets.duration) > 0) {
    return Math.round(Number(targets.duration) * (targets.durationUnit === 'seconds' ? 1 : 60));
  }
  if (Number(targets.durationSeconds) > 0) return Math.round(Number(targets.durationSeconds));
  return 0;
}

function actualDurationSeconds(actuals) {
  if (Number(actuals.durationSeconds) > 0) return Math.round(Number(actuals.durationSeconds));
  if (Number(actuals.duration) > 0) {
    return Math.round(Number(actuals.duration) * (actuals.durationUnit === 'seconds' ? 1 : 60));
  }
  return 0;
}

function serializeLogItem(row) {
  const actuals = parseJson(row.actuals, {});
  const targets = parseJson(row.targets, {});
  return {
    sessionItemId: Number(row.session_item_id),
    exerciseId: Number(row.exercise_id),
    status: row.status,
    actuals,
    targets,
    comparisons: buildComparisons(targets, actuals),
    skipReason: row.skip_reason || '',
    note: row.note || '',
    updatedAt: Number(row.updated_at)
  };
}

function serializeLog(row, items) {
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id),
    status: row.status,
    source: row.source,
    completedAt: row.completed_at == null ? null : Number(row.completed_at),
    sessionFeel: row.session_feel || null,
    discomfort: row.discomfort || '',
    note: row.note || '',
    items,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function loadLog(sessionId) {
  const logRow = queryRow('SELECT * FROM training_session_logs WHERE session_id = ?', [sessionId]);
  if (!logRow) return null;
  const items = queryRows(
    `SELECT log_item.*, db_item.exercise_id, db_item.targets
     FROM training_session_log_items log_item
     JOIN training_session_items db_item ON db_item.id = log_item.session_item_id
     WHERE log_item.session_log_id = ?
     ORDER BY db_item.position, db_item.id`,
    [logRow.id]
  ).map(serializeLogItem);
  return serializeLog(logRow, items);
}

/**
 * 一次取某段日期内全部训练单元，附带逐项目标、已记录的实际值，以及各项目上一次的成绩。
 * 上一次成绩用于移动端预填重量——器械训练里这是最高频的参照。
 */
const DAY_SESSIONS_SQL = `
  SELECT
    s.id AS session_id,
    s.plan_id AS plan_id,
    s.scheduled_date AS scheduled_date,
    s.sequence AS sequence,
    s.name AS name,
    s.notes AS notes,
    s.status AS planned_status,
    p.name AS plan_name,
    log.id AS log_id,
    log.status AS log_status,
    log.source AS log_source,
    log.completed_at AS log_completed_at,
    log.session_feel AS log_session_feel,
    log.discomfort AS log_discomfort,
    log.note AS log_note,
    db_item.id AS session_item_id,
    db_item.exercise_id AS exercise_id,
    db_item.position AS position,
    db_item.verification_mode AS verification_mode,
    db_item.targets AS targets,
    exercise.name AS exercise_name,
    exercise.icon AS exercise_icon,
    exercise.category AS exercise_category,
    exercise.equipment AS exercise_equipment,
    exercise.metrics AS exercise_metrics,
    item.id AS log_item_id,
    item.status AS log_item_status,
    item.actuals AS log_item_actuals,
    item.skip_reason AS log_item_skip_reason,
    item.note AS log_item_note,
    (
      SELECT COALESCE(json_group_array(json_object('actuals', latest.actuals, 'date', latest.scheduled_date)), '[]')
      FROM (
        SELECT history.actuals AS actuals, history_session.scheduled_date AS scheduled_date
        FROM training_session_log_items history
        JOIN training_session_items previous_item ON previous_item.id = history.session_item_id
        JOIN training_session_logs history_log ON history_log.id = history.session_log_id
        JOIN training_sessions history_session ON history_session.id = history_log.session_id
        WHERE previous_item.exercise_id = db_item.exercise_id
          AND history_session.id <> s.id
        ORDER BY history_session.scheduled_date DESC, history.id DESC
        LIMIT 1
      ) AS latest
    ) AS last_actuals
  FROM training_sessions s
  JOIN training_plans p ON p.id = s.plan_id
  JOIN training_session_items db_item ON db_item.session_id = s.id
  JOIN training_exercises exercise ON exercise.id = db_item.exercise_id
  LEFT JOIN training_session_logs log ON log.session_id = s.id
  LEFT JOIN training_session_log_items item
    ON item.session_log_id = log.id AND item.session_item_id = db_item.id
  WHERE s.scheduled_date >= ? AND s.scheduled_date <= ?
  ORDER BY s.scheduled_date, s.sequence, s.id, db_item.position, db_item.id
`;

const SESSION_DETAIL_SQL = DAY_SESSIONS_SQL.replace(
  'WHERE s.scheduled_date >= ? AND s.scheduled_date <= ?',
  'WHERE s.id = ?'
);

/**
 * 训练单元视图。只暴露需要人工确认的项目（manual）：
 * 自动验证项目由手表数据匹配确认，不该出现在手动确认流程里。
 * 自动项目数量单独返回，供前端提示「其余项目由手表自动确认」。
 */
function serializeDaySession(row, itemRows) {
  const manualRows = itemRows.filter((item) => item.verification_mode === 'manual');
  const items = manualRows.map((item) => ({
    sessionItemId: Number(item.session_item_id),
    exerciseId: Number(item.exercise_id),
    position: Number(item.position),
    verificationMode: item.verification_mode,
    exercise: {
      name: item.exercise_name,
      icon: item.exercise_icon,
      category: item.exercise_category,
      equipment: item.exercise_equipment || '',
      metrics: parseJson(item.exercise_metrics, [])
    },
    targets: parseJson(item.targets, {}),
    lastActuals: readHistoryActuals(item.last_actuals),
    lastPerformedAt: readHistoryDate(item.last_actuals),
    execution: item.log_item_id
      ? {
          sessionItemId: Number(item.session_item_id),
          status: item.log_item_status,
          actuals: parseJson(item.log_item_actuals, {}),
          skipReason: item.log_item_skip_reason || '',
          note: item.log_item_note || ''
        }
      : null
  }));

  return {
    sessionId: Number(row.session_id),
    planId: Number(row.plan_id),
    planName: row.plan_name,
    scheduledDate: row.scheduled_date,
    sequence: Number(row.sequence),
    name: row.name || '',
    planNotes: row.notes || '',
    plannedStatus: row.planned_status,
    itemCount: items.length,
    autoItemCount: itemRows.length - manualRows.length,
    doneCount: items.filter((item) => item.execution?.status === 'done').length,
    skippedCount: items.filter((item) => item.execution?.status === 'skipped').length,
    items,
    execution: row.log_id
      ? {
          id: Number(row.log_id),
          status: row.log_status,
          source: row.log_source,
          completedAt: row.log_completed_at == null ? null : Number(row.log_completed_at),
          sessionFeel: row.log_session_feel || null,
          discomfort: row.log_discomfort || '',
          note: row.log_note || ''
        }
      : null
  };
}

function groupDayRows(rows) {
  const sessions = new Map();
  for (const row of rows) {
    const bucket = sessions.get(row.session_id);
    if (bucket) {
      bucket.rows.push(row);
      continue;
    }
    sessions.set(row.session_id, { row, rows: [row] });
  }
  return [...sessions.values()].map(({ row, rows: itemRows }) => serializeDaySession(row, itemRows));
}

function fetchSessionsForRange(startDate, endDate) {
  return groupDayRows(queryRows(DAY_SESSIONS_SQL, [startDate, endDate]));
}

function fetchSessionDetail(sessionId) {
  return groupDayRows(queryRows(SESSION_DETAIL_SQL, [sessionId]))[0] || null;
}

export function getTrainingExecution(req, res) {
  try {
    const date = req.query.date;
    if (!isValidDate(date)) return res.status(400).json({ error: 'Invalid date' });
    return res.json({ date, sessions: fetchSessionsForRange(date, date) });
  } catch (error) {
    console.error('Error getting training execution:', error);
    return res.status(500).json({ error: 'Failed to fetch training execution' });
  }
}

export function getTrainingExecutionHistory(req, res) {
  try {
    const today = toDateString(new Date());
    const endDate = isValidDate(req.query.endDate) ? req.query.endDate : today;
    const startDate = isValidDate(req.query.startDate) ? req.query.startDate : addDays(endDate, -29);
    if (!validateDateRange(startDate, endDate)) {
      return res.status(400).json({ error: 'End date must not be before start date' });
    }
    if (diffInDays(startDate, endDate) > MAX_RANGE_DAYS) {
      return res.status(400).json({ error: `Date range must not exceed ${MAX_RANGE_DAYS} days` });
    }
    const sessions = fetchSessionsForRange(startDate, endDate).filter((session) => session.execution);
    return res.json({ startDate, endDate, sessions });
  } catch (error) {
    console.error('Error getting training execution history:', error);
    return res.status(500).json({ error: 'Failed to fetch training execution history' });
  }
}

export function getTrainingSessionExecution(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid training session id' });
    const session = fetchSessionDetail(id);
    if (!session) return res.status(404).json({ error: 'Training session not found' });
    return res.json({ session, execution: loadLog(id) });
  } catch (error) {
    console.error('Error getting training session execution:', error);
    return res.status(500).json({ error: 'Failed to fetch training session execution' });
  }
}

/**
 * 校验一次训练执行提交。
 * 只接受需要人工确认（manual）的项目：自动验证项目由手表数据匹配确认，
 * 既不需要也不允许在手动确认流程里提交。
 * @param {object} payload 请求体
 * @param {Array<{ id: number, metrics: string, verification_mode: string }>} sessionItems 该训练单元的手动项目
 * @returns {{ errors: Record<string, string> }|{ value: object }} 校验结果
 */
function validateExecutionPayload(payload, sessionItems) {
  const errors = {};
  const value = {
    status: payload?.status || 'completed',
    sessionFeel: payload?.sessionFeel == null || payload?.sessionFeel === '' ? null : payload.sessionFeel,
    discomfort: text(payload?.discomfort, 2000),
    note: text(payload?.note, 2000),
    completedAt: payload?.completedAt === undefined || payload?.completedAt === null ? Date.now() : payload.completedAt,
    items: []
  };

  if (!LOG_STATUSES.has(value.status)) errors.status = 'Invalid training execution status';
  if (value.sessionFeel !== null && !SESSION_FEELS.has(value.sessionFeel)) {
    errors.sessionFeel = 'Invalid session feel';
  }
  if (value.discomfort === null) errors.discomfort = 'Discomfort must be 2000 characters or fewer';
  if (value.note === null) errors.note = 'Note must be 2000 characters or fewer';

  const completedAt = Number(value.completedAt);
  if (!Number.isFinite(completedAt) || completedAt <= 0) errors.completedAt = 'Invalid completion time';
  else value.completedAt = completedAt;

  const rawItems = Array.isArray(payload?.items) ? payload.items : null;
  if (!rawItems) {
    errors.items = 'Submit one entry per training item';
    return { errors };
  }

  const itemById = new Map(sessionItems.map((item) => [Number(item.id), item]));
  const seen = new Set();
  rawItems.forEach((rawItem, index) => {
    const sessionItemId = Number(rawItem?.sessionItemId);
    const sessionItem = itemById.get(sessionItemId);
    if (!Number.isInteger(sessionItemId) || !sessionItem) {
      // 自动验证项目也会走到这里：它们不属于手动确认范围。
      errors[`items.${index}.sessionItemId`] = 'This training item does not need manual confirmation';
      return;
    }
    if (seen.has(sessionItemId)) {
      errors[`items.${index}.sessionItemId`] = 'Each training item may only appear once';
      return;
    }
    seen.add(sessionItemId);

    const status = rawItem?.status || 'done';
    if (!ITEM_STATUSES.has(status)) {
      errors[`items.${index}.status`] = 'Invalid training item status';
      return;
    }

    const supportedMetrics = new Set(parseJson(sessionItem.metrics, []));
    if (supportedMetrics.has('duration')) supportedMetrics.add('durationSeconds');

    const note = text(rawItem?.note, 500);
    if (note === null) errors[`items.${index}.note`] = 'Note must be 500 characters or fewer';

    if (status === 'skipped') {
      const skipReason = normalizeSkipReason(rawItem?.skipReason);
      if (!skipReason) errors[`items.${index}.skipReason`] = 'Choose why this item was skipped';
      value.items.push({ sessionItemId, status, actuals: {}, skipReason, note: note || '' });
      return;
    }

    let actualsInvalid = false;
    const actuals = {};
    const rawActuals = rawItem?.actuals && typeof rawItem.actuals === 'object' ? rawItem.actuals : {};
    for (const [metric, rawValue] of Object.entries(rawActuals)) {
      const normalized = normalizeActualValue(metric, rawValue, supportedMetrics);
      if (!normalized.ok) {
        errors[`items.${index}.actuals`] = `Unsupported actual value for ${metric}`;
        actualsInvalid = true;
        break;
      }
      if (normalized.value !== null) actuals[metric] = normalized.value;
    }
    if (actualsInvalid) return;
    if (Object.keys(actuals).length === 0) {
      errors[`items.${index}.actuals`] = 'Record at least one value for a completed item';
    }
    value.items.push({ sessionItemId, status, actuals, skipReason: '', note: note || '' });
  });

  // 训练单元状态由客户端按逐项结果汇总，这里只拦截自相矛盾的组合。
  // partial 表示「做了但没达到目标」，因此允许全部项目都是 done。
  const doneCount = value.items.filter((item) => item.status === 'done').length;
  if (!errors.status && value.items.length > 0 && doneCount === 0 && value.status !== 'skipped') {
    errors.status = 'Mark the session as skipped when no item was completed';
  }
  if (!errors.status && value.status === 'skipped' && doneCount > 0) {
    errors.status = 'A skipped session cannot contain completed items';
  }

  return Object.keys(errors).length > 0 ? { errors } : { value };
}

/**
 * 覆盖式保存一次训练执行记录。同一训练单元重复提交为幂等更新。
 */
export function saveTrainingSessionExecution(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid training session id' });

    const session = queryRow('SELECT id FROM training_sessions WHERE id = ?', [id]);
    if (!session) return res.status(404).json({ error: 'Training session not found' });

    // 只加载需要人工确认的项目：自动验证项目不参与手动记录，也不会出现在响应里。
    const sessionItems = queryRows(
      `SELECT item.id, item.exercise_id, item.verification_mode, exercise.metrics
       FROM training_session_items item
       JOIN training_exercises exercise ON exercise.id = item.exercise_id
       WHERE item.session_id = ? AND item.verification_mode = 'manual'
       ORDER BY item.position, item.id`,
      [id]
    );
    if (sessionItems.length === 0) {
      return res.status(409).json({
        code: 'SESSION_HAS_NO_MANUAL_ITEMS',
        message: 'This session has no items that need manual confirmation'
      });
    }

    const validation = validateExecutionPayload(req.body, sessionItems);
    if (validation.errors) {
      return res.status(400).json({ error: 'Invalid training execution', fields: validation.errors });
    }

    const value = validation.value;
    // 手动确认流程产出的记录来源恒为 manual；手表匹配的数据由自动匹配流程写入。
    const source = 'manual';

    const db = databaseService.getDb();
    const now = Date.now();
    let transactionOpen = false;
    try {
      db.run('BEGIN IMMEDIATE');
      transactionOpen = true;
      db.run(
        `INSERT INTO training_session_logs
          (session_id, status, source, completed_at, session_feel, discomfort, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           status = excluded.status,
           source = excluded.source,
           completed_at = excluded.completed_at,
           session_feel = excluded.session_feel,
           discomfort = excluded.discomfort,
           note = excluded.note,
           updated_at = excluded.updated_at`,
        [id, value.status, source, value.completedAt, value.sessionFeel, value.discomfort, value.note, now, now]
      );
      const logId = Number(queryRow('SELECT id FROM training_session_logs WHERE session_id = ?', [id]).id);
      db.run('DELETE FROM training_session_log_items WHERE session_log_id = ?', [logId]);
      for (const item of value.items) {
        db.run(
          `INSERT INTO training_session_log_items
            (session_log_id, session_item_id, status, actuals, skip_reason, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [logId, item.sessionItemId, item.status, JSON.stringify(item.actuals), item.skipReason, item.note, now, now]
        );
      }
      db.run('COMMIT');
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) db.run('ROLLBACK');
      throw error;
    }

    return res.json({ sessionId: id, execution: loadLog(id) });
  } catch (error) {
    console.error('Error saving training session execution:', error);
    return res.status(500).json({ error: 'Failed to save training session execution' });
  }
}
