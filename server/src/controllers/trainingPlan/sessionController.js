// 训练课次的增删改、批量创建，以及按日期/计划的全局列表查询。
import { databaseService } from '../../services/database.js';
import { loadNormalizedSportRecords, todayDateKey } from '../../services/sportRecordRepository.js';
import { queryRow, queryRows } from './queryHelpers.js';
import { appendSessionItems, getPlan, getSession, saveSessionItems, validateExercises } from './planRepository.js';
import { respondConflict } from './responses.js';
import { completionStatusOf, deriveStatusForSession, evaluateAutoMatches } from './sessionStatus.js';
import { serializeSessionListItem } from './serializers.js';
import { isValidDate, validateSessionPayload } from './validation.js';

// 全局训练单元页的筛选项：只保留"练完没有"这一类结果，待开始是时间位置、无数据和无法验证是
// 数据问题，都不参与筛选。未完成不是存量状态，是过期且推导结果仍为 planned（见下面的口径）。
const SESSION_COMPLETION_STATUSES = new Set(['achieved', 'partial', 'skipped', 'missed']);

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
