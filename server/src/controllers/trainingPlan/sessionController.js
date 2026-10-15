// 训练课次的增删改、批量创建、按复合条件的全局列表查询，以及按 ids 或按同一套复合条件的批量删除。
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

/**
 * 打卡状态筛选：'true' 只看留过执行记录的单元，'false' 只看没留过的。
 * 执行记录在 training_session_logs 里是一行，列表本来就 LEFT JOIN 了它，所以这个条件能直接在
 * SQL 里筛，不需要像完成状态那样读取时推导。布尔和字符串两种写法都收，统一归一成字符串。
 */
const SESSION_LOGGED_VALUES = new Map([
  [true, 'true'],
  [false, 'false'],
  ['true', 'true'],
  ['false', 'false']
]);

/** 关键词检索的长度上限，和列表页输入框的 maxlength 一致；超长截断而不是报错。 */
const SESSION_SEARCH_MAX_LENGTH = 60;

/** 一次按 id 批量删除的上限。要删更多就用筛选条件删除，那条路径由服务端自己求交。 */
const SESSION_DELETE_MAX_IDS = 1000;

/** IN 查询的分片大小：SQLite 的变量上限在不同版本上是 999 或 32766，分片后两边都安全。 */
const SQL_CHUNK_SIZE = 400;

/**
 * 列表每一行的投影。列表和批量删除共用同一份，所以"筛选结果"和"被删掉的行"是同一批。
 */
const SESSION_LIST_SELECT = `SELECT s.*, p.name AS plan_name,
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
   LEFT JOIN training_session_logs log ON log.session_id = s.id`;

const SESSION_LIST_ORDER = 'ORDER BY s.scheduled_date DESC, s.sequence ASC, s.id DESC';

export function listTrainingSessions(req, res) {
  try {
    const page = Number.isInteger(Number(req.query.page)) && Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const pageSize =
      Number.isInteger(Number(req.query.pageSize)) && Number(req.query.pageSize) > 0
        ? Math.min(Number(req.query.pageSize), 100)
        : 10;
    // 状态里含读取时才算的有氧匹配结果，SQL 筛不出来，所以先按 SQL 条件取出候选行，
    // 派生完状态再过滤和分页；不能让 SQL 先分页，否则筛选结果和 total 都会对不上。
    const { rows, statuses } = selectSessionMatches(req.query);
    const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
    return res.json({
      sessions: pageRows.map((row) => serializeSessionListItem(row, statuses.get(Number(row.id)))),
      total: rows.length,
      // 匹配结果里已有打卡记录的条数：批量删除前用它提示"这些记录会一起消失"。
      executionCount: rows.filter((row) => row.execution_id != null).length,
      page,
      pageSize
    });
  } catch (error) {
    console.error('Error listing training sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch training sessions' });
  }
}

/**
 * 复合检索条件：日期区间、所属计划、完成状态、打卡状态、训练内容关键词，五者之间是 AND。
 *
 * 列表和批量删除共用这一份条件，批量删除会按同样的条件重新求交，而不是接收客户端传来的
 * 行 id 列表，所以"删掉筛选结果"不会和分页看到的行数对不上。
 *
 * @param {object} query 查询条件（列表来自 req.query，删除来自请求体的 filter）
 * @returns {{whereClause: string, params: Array<*>, status: string, logged: string, hasCondition: boolean}}
 */
function buildSessionFilter(query = {}) {
  const conditions = [];
  const params = [];
  if (isValidDate(query.startDate)) {
    conditions.push('s.scheduled_date >= ?');
    params.push(query.startDate);
  }
  if (isValidDate(query.endDate)) {
    conditions.push('s.scheduled_date <= ?');
    params.push(query.endDate);
  }
  if (Number.isInteger(Number(query.planId)) && Number(query.planId) > 0) {
    conditions.push('p.id = ?');
    params.push(Number(query.planId));
  }
  const keyword = normalizeSessionKeyword(query.search);
  if (keyword) {
    const pattern = `%${escapeLikePattern(keyword)}%`;
    // 关键词只搜"训练内容"，也就是这个单元里的训练项目名：加错单元时最直接的线索就是
    // "这天的项目配错了"。单元名称和备注是自由文本，混进来会让这个条件的结果不可预期。
    conditions.push(`EXISTS (SELECT 1 FROM training_session_items keyword_item
        JOIN training_exercises keyword_exercise ON keyword_exercise.id = keyword_item.exercise_id
        WHERE keyword_item.session_id = s.id AND keyword_exercise.name LIKE ? ESCAPE '\\')`);
    params.push(pattern);
  }
  const status = SESSION_COMPLETION_STATUSES.has(query.status) ? query.status : '';
  const logged = normalizeLoggedFilter(query.logged);
  if (logged) {
    // 用 EXISTS 而不是列表里那个 log 别名：同一份 whereClause 还会被项目行查询复用，
    // 那边没有 join 执行记录表，写成别名会直接报 "no such column: log.id"。
    conditions.push(
      logged === 'true'
        ? 'EXISTS (SELECT 1 FROM training_session_logs logged_session WHERE logged_session.session_id = s.id)'
        : 'NOT EXISTS (SELECT 1 FROM training_session_logs logged_session WHERE logged_session.session_id = s.id)'
    );
  }
  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    status,
    logged,
    // 完成状态是读取时推导的，SQL 里筛不出来，但它同样是一个生效的条件。
    hasCondition: conditions.length > 0 || Boolean(status)
  };
}

function normalizeLoggedFilter(value) {
  return SESSION_LOGGED_VALUES.get(value) || '';
}

function normalizeSessionKeyword(value) {
  return typeof value === 'string' ? value.trim().slice(0, SESSION_SEARCH_MAX_LENGTH) : '';
}

/** 关键词里的 % 和 _ 是 LIKE 通配符，用户输入要当字面量处理。 */
function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * 取出筛选后的全部行（不分页）并派生每行的完成状态。
 * 状态过滤放在这里而不是 SQL 里，和列表、计划详情、训练日历保持同一个口径。
 */
function selectSessionMatches(filter) {
  const built = buildSessionFilter(filter);
  const rows = queryRows(`${SESSION_LIST_SELECT} ${built.whereClause} ${SESSION_LIST_ORDER}`, built.params);
  const statuses = deriveSessionListStatuses(rows, todayDateKey(), built.whereClause, built.params);
  const matched = built.status ? rows.filter((row) => statuses.get(Number(row.id)) === built.status) : rows;
  return { rows: matched, statuses, status: built.status, hasCondition: built.hasCondition };
}

/** 批量删除的筛选条件校验：删除是破坏性操作，认不出的条件直接报错，不静默忽略。 */
function validateSessionDeleteFilter(filter) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return { errors: { filter: 'Filter must be an object' } };
  }
  const errors = {};
  if (filter.startDate != null && !isValidDate(filter.startDate)) errors.startDate = 'Invalid start date';
  if (filter.endDate != null && !isValidDate(filter.endDate)) errors.endDate = 'Invalid end date';
  if (filter.planId != null && !(Number.isInteger(Number(filter.planId)) && Number(filter.planId) > 0)) {
    errors.planId = 'Invalid plan id';
  }
  if (filter.status != null && !SESSION_COMPLETION_STATUSES.has(filter.status)) {
    errors.status = 'Invalid completion status';
  }
  if (filter.logged != null && !normalizeLoggedFilter(filter.logged)) {
    errors.logged = 'Invalid check-in state';
  }
  if (filter.search != null && typeof filter.search !== 'string') errors.search = 'Invalid search keyword';
  if (Object.keys(errors).length > 0) return { errors };
  return {
    value: {
      startDate: filter.startDate,
      endDate: filter.endDate,
      planId: filter.planId,
      status: filter.status,
      logged: filter.logged,
      search: filter.search
    }
  };
}

function chunkIds(ids) {
  const chunks = [];
  for (let index = 0; index < ids.length; index += SQL_CHUNK_SIZE) {
    chunks.push(ids.slice(index, index + SQL_CHUNK_SIZE));
  }
  return chunks;
}

/**
 * 批量删除训练单元。两种入口互斥：
 *
 * - `{ ids: [...] }`：删掉明确勾选的行（列表页勾选后删除）。id 本身就是"删哪些"的完整声明，
 *   不需要额外的数量确认。
 * - `{ filter: {...}, expectedCount }`：按和列表完全相同的复合条件重新求交后删除
 *   （"删掉筛选结果"），避免客户端为了跨页全选先取回上千个 id 再回传。
 *   **必须带上调用方当时看到的条数**：条件写错、或者从看到数字到提交之间数据变了，
 *   服务端就拒绝，而不是删掉另一批。
 *
 * 训练项目和执行记录都由外键 ON DELETE CASCADE 清理，这里不手写子表删除。
 * 已有的打卡数据会随之消失，所以客户端必须在确认弹窗里把条数说清楚。
 */
export function deleteTrainingSessions(req, res) {
  const body = req.body || {};
  const hasIds = Array.isArray(body.ids) && body.ids.length > 0;
  const hasFilter = body.filter != null;
  if (hasIds && hasFilter) {
    return res.status(400).json({
      code: 'SESSION_DELETE_SCOPE_INVALID',
      error: 'Provide either session ids or a filter, not both'
    });
  }
  if (!hasIds && !hasFilter) {
    return res.status(400).json({
      code: 'SESSION_DELETE_SCOPE_REQUIRED',
      error: 'Session ids or a filter is required'
    });
  }

  let targets;
  if (hasIds) {
    if (body.ids.length > SESSION_DELETE_MAX_IDS) {
      return res.status(400).json({
        code: 'SESSION_DELETE_TOO_MANY',
        error: `At most ${SESSION_DELETE_MAX_IDS} sessions can be deleted at once`,
        details: { max: SESSION_DELETE_MAX_IDS }
      });
    }
    if (!body.ids.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)) {
      return res.status(400).json({
        code: 'SESSION_DELETE_IDS_INVALID',
        error: 'Session ids must be positive integers'
      });
    }
    targets = { scope: 'ids', ids: [...new Set(body.ids.map(Number))] };
  } else {
    const validation = validateSessionDeleteFilter(body.filter);
    if (validation.errors) {
      return res.status(400).json({
        code: 'SESSION_FILTER_INVALID',
        error: 'Invalid session filter',
        fields: validation.errors
      });
    }
    let matches;
    try {
      matches = selectSessionMatches(validation.value);
    } catch (error) {
      console.error('Error resolving training sessions to delete:', error);
      return res.status(500).json({ error: 'Failed to resolve training sessions to delete' });
    }
    // 空条件等于"删掉全部训练单元"。这个入口不存在这种用法，也就不该被误触。
    if (!matches.hasCondition) {
      return res.status(400).json({
        code: 'SESSION_DELETE_FILTER_REQUIRED',
        error: 'At least one filter condition is required'
      });
    }
    const expectedCount = body.expectedCount;
    if (!Number.isInteger(expectedCount) || expectedCount < 0) {
      return res.status(400).json({
        code: 'SESSION_DELETE_COUNT_REQUIRED',
        error: 'expectedCount must be a non-negative integer when deleting by filter'
      });
    }
    // 数量确认：条件没错但数据变了（另一个页面刚删过、计划刚改过）时也必须停在这里，
    // 否则用户确认的是 12 条、实际删掉的可能是另一批。空集合可以由"条件为空"自己看住，
    // 但"条件合法却和预期不符"只有这个数字能发现。
    if (matches.rows.length !== expectedCount) {
      return res.status(409).json({
        code: 'SESSION_DELETE_COUNT_CHANGED',
        error: 'The number of sessions matching the filter changed',
        details: { expectedCount, matchedCount: matches.rows.length }
      });
    }
    targets = { scope: 'filter', ids: matches.rows.map((row) => Number(row.id)) };
  }

  const db = databaseService.getDb();
  let transactionOpen = false;
  try {
    const existingIds = chunkIds(targets.ids).flatMap((chunk) =>
      queryRows(`SELECT id FROM training_sessions WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk).map((row) =>
        Number(row.id)
      )
    );

    db.run('BEGIN IMMEDIATE');
    transactionOpen = true;
    for (const chunk of chunkIds(existingIds)) {
      db.run(`DELETE FROM training_sessions WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk);
    }
    db.run('COMMIT');
    transactionOpen = false;
    return res.json({
      scope: targets.scope,
      requestedCount: targets.ids.length,
      deletedIds: existingIds,
      deletedCount: existingIds.length
    });
  } catch (error) {
    if (transactionOpen) db.run('ROLLBACK');
    console.error('Error batch deleting training sessions:', error);
    return res.status(500).json({ error: 'Failed to batch delete training sessions' });
  }
}

/**
 * 批量推导训练单元列表里每一行的完成状态。
 * 有氧匹配依赖导入的运动记录，只能读取时算；项目行用同一套筛选条件和训练单元一起取出，
 * 避免按 id 列表拼一条可能超过 SQLite 参数上限的 IN 查询。
 * @param {Array<object>} sessionRows 候选训练单元行
 * @param {string} today 今天的日期
 * @param {string} whereClause 列表的复合筛选条件（引用 s.scheduled_date、p.id 和训练项目名）
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
