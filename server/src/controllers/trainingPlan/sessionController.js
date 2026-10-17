// 训练课次的增删改、批量创建、按复合条件的全局列表查询，以及按 ids 或按同一套复合条件的批量删除。
// 复合条件和"候选行 + 派生状态"的查询层在 sessionFilterQuery.js，训练项目级的批量删除也用它。
import { databaseService } from '../../services/database.js';
import { queryRow, queryRows } from './queryHelpers.js';
import {
  appendSessionItems,
  getPlan,
  getSession,
  saveSessionItems,
  syncSessionItems,
  validateExercises
} from './planRepository.js';
import { respondConflict } from './responses.js';
import { selectSessionMatches, validateSessionDeleteFilter } from './sessionFilterQuery.js';
import { serializeSessionListItem } from './serializers.js';
import { validateSessionPayload } from './validation.js';

/** 一次按 id 批量删除的上限。要删更多就用筛选条件删除，那条路径由服务端自己求交。 */
const SESSION_DELETE_MAX_IDS = 1000;

/** IN 查询的分片大小：SQLite 的变量上限在不同版本上是 999 或 32766，分片后两边都安全。 */
const SQL_CHUNK_SIZE = 400;

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

  const overwriteExistingItems = req.body?.overwriteExistingItems === true;
  const db = databaseService.getDb();
  let transactionOpen = false;
  try {
    const now = Date.now();
    db.run('BEGIN IMMEDIATE');
    transactionOpen = true;
    let createdCount = 0;
    let updatedCount = 0;
    let itemCount = 0;
    let overwrittenItemCount = 0;
    sessionValues.forEach((session, index) => {
      const existingSession = existingBySlot.get(`${session.scheduledDate}:${session.sequence}`);
      if (existingSession) {
        const existingItems = queryRows(
          'SELECT id, exercise_id FROM training_session_items WHERE session_id = ? ORDER BY position, id',
          [existingSession.id]
        );
        const existingByExercise = new Map(existingItems.map((item) => [Number(item.exercise_id), Number(item.id)]));
        const newItems = [];
        let overwritten = 0;
        for (const item of exerciseValues[index]) {
          const existingItemId = existingByExercise.get(item.exerciseId);
          if (existingItemId == null) {
            newItems.push(item);
            continue;
          }
          // 默认保留原有项目；用户确认覆盖时，同一动作只更新目标与验证方式，不新增重复行。
          if (!overwriteExistingItems) continue;
          db.run('UPDATE training_session_items SET verification_mode = ?, targets = ?, updated_at = ? WHERE id = ?', [
            item.verificationMode,
            JSON.stringify(item.targets),
            now,
            existingItemId
          ]);
          overwritten += 1;
        }
        appendSessionItems(db, existingSession.id, newItems, now);
        if (newItems.length > 0 || overwritten > 0) {
          db.run('UPDATE training_sessions SET updated_at = ? WHERE id = ?', [now, existingSession.id]);
          updatedCount += 1;
          itemCount += newItems.length;
          overwrittenItemCount += overwritten;
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
      overwrittenItemCount,
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
    // 差异同步：只更新/增删真正变化的项目，保留已有项目行和它们的打卡记录。
    syncSessionItems(db, id, exerciseValidation.items, now);
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
