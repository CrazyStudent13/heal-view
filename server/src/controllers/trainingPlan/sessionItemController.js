// 训练单元内"训练项目"（training_session_items）的批量删除。
//
// 需求场景：某个训练项目在某个时间段里配错了（或后来决定不练了），要把它从这一批训练单元里
// 一起拿掉，而不是逐个单元打开编辑弹窗删。作用范围直接复用训练单元列表的复合条件
// （日期区间 / 计划 / 完成状态 / 打卡状态 / 训练内容关键词），所以"列表上筛出来的那批单元"
// 和"这次真正动手的单元"永远是同一批。
//
// 两条入口：
//   - `{ ids }`：删掉明确点选的几条项目（列表展开行里的单条删除）。
//   - `{ exerciseId, filter, expectedCount }`：在筛选出的训练单元里，删掉某个训练项目的全部记录；
//     expectedCount 是预览里给用户看的条数，对不上就 409。
//
// 一个刻意的约束：**不把任何训练单元删空**。某个单元只剩这一个项目时跳过它（结果里回报被跳过的
// 单元数），因为空单元既没有任何目标可打卡，也不符合"单元至少要有一个项目"的既有校验。想清掉
// 这种单元，用训练单元的批量删除。
import { databaseService } from '../../services/database.js';
import { queryRow, queryRows } from './queryHelpers.js';
import { selectSessionMatches, validateSessionDeleteFilter } from './sessionFilterQuery.js';
import { deleteSessionItems, findSessionItems } from './planRepository.js';

/** 一次按 id 批量删除的上限。 */
const SESSION_ITEM_DELETE_MAX_IDS = 1000;

/** IN 查询的分片大小：SQLite 的变量上限在不同版本上是 999 或 32766，分片后两边都安全。 */
const SQL_CHUNK_SIZE = 400;

function chunkValues(values) {
  const chunks = [];
  for (let index = 0; index < values.length; index += SQL_CHUNK_SIZE) {
    chunks.push(values.slice(index, index + SQL_CHUNK_SIZE));
  }
  return chunks;
}

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

/**
 * 训练项目的行投影：带上"这个单元一共有几个项目"和"这条项目有没有打卡记录"。
 * 前者决定它能不能删（不能把单元删空），后者决定要在确认弹窗里提示多少条打卡记录会消失。
 */
const SESSION_ITEM_SELECT = `SELECT item.id AS item_id, item.session_id AS session_id,
    (SELECT COUNT(*) FROM training_session_items sibling WHERE sibling.session_id = item.session_id) AS sibling_count,
    (SELECT COUNT(*) FROM training_session_log_items log_item WHERE log_item.session_item_id = item.id) AS log_item_count
  FROM training_session_items item`;

/** 在给定的一批训练单元里，找出某个训练项目的全部记录。 */
function collectExerciseItems(exerciseId, sessionIds) {
  return chunkValues(sessionIds).flatMap((chunk) =>
    queryRows(
      `${SESSION_ITEM_SELECT}
       WHERE item.exercise_id = ? AND item.session_id IN (${chunk.map(() => '?').join(', ')})`,
      [exerciseId, ...chunk]
    )
  );
}

/** 只剩这一个项目的单元要跳过：删掉会留下一个没有训练内容的空单元。 */
const isDeletable = (item) => Number(item.sibling_count) > 1;
const pickIds = (items) => items.map((item) => Number(item.item_id));

/**
 * 汇总一次"按训练项目批量删除"会删掉什么。预览和真正的删除用同一个函数，
 * 所以弹窗里的数字和执行结果不会对不上。
 * @returns {?object} 训练项目不存在时返回 null
 */
function summarizeExerciseDeletion(exerciseId, filter) {
  const exercise = queryRow('SELECT id, name FROM training_exercises WHERE id = ?', [exerciseId]);
  if (!exercise) return null;

  const sessionMatches = selectSessionMatches(filter);
  const sessionIds = sessionMatches.rows.map((row) => Number(row.id));
  const items = sessionIds.length === 0 ? [] : collectExerciseItems(exerciseId, sessionIds);
  const deletable = items.filter(isDeletable);
  const skipped = items.filter((item) => !isDeletable(item));

  return {
    hasCondition: sessionMatches.hasCondition,
    exerciseName: exercise.name,
    matchedSessionCount: new Set(items.map((item) => Number(item.session_id))).size,
    matchedItemCount: items.length,
    deletableIds: pickIds(deletable),
    deletableItemCount: deletable.length,
    skippedIds: pickIds(skipped),
    skippedCount: skipped.length,
    executionItemCount: deletable.filter((item) => Number(item.log_item_count) > 0).length
  };
}

/**
 * 删除预览：弹窗里选定训练项目后调用。
 * 作用范围的条件和列表一致（宽松解析，认不出的条件当没给）。
 */
export function previewTrainingSessionItemDeletion(req, res) {
  try {
    const exerciseId = Number(req.query.exerciseId);
    if (!isPositiveInteger(exerciseId)) {
      return res.status(400).json({
        code: 'SESSION_ITEM_EXERCISE_REQUIRED',
        error: 'A training exercise is required'
      });
    }
    const summary = summarizeExerciseDeletion(exerciseId, req.query);
    if (!summary) {
      return res.status(404).json({
        code: 'SESSION_ITEM_EXERCISE_NOT_FOUND',
        error: 'Training exercise not found'
      });
    }
    return res.json({
      exerciseId,
      exerciseName: summary.exerciseName,
      matchedSessionCount: summary.matchedSessionCount,
      matchedItemCount: summary.matchedItemCount,
      deletableItemCount: summary.deletableItemCount,
      skippedCount: summary.skippedCount,
      executionItemCount: summary.executionItemCount,
      // 前端据此判断"作用范围"是否已经收紧；没设任何筛选条件时提示先筛。
      hasFilter: summary.hasCondition
    });
  } catch (error) {
    console.error('Error previewing training session item deletion:', error);
    return res.status(500).json({ error: 'Failed to preview training session item deletion' });
  }
}

/**
 * 批量删除训练项目。两种入口互斥（和训练单元批量删除同一套约定）：
 *
 * - `{ ids }`：删掉明确点选的项目。id 列表本身就是完整声明，不需要数量确认；
 *   只剩最后一个项目的单元会跳过而不是删空。
 * - `{ exerciseId, filter, expectedCount }`：同一个训练项目 + 同一套单元条件重新求交；
 *   必须声明调用方看到的条数，对不上返回 409。
 *
 * 打卡项目行（training_session_log_items）由外键 ON DELETE CASCADE 清理；训练单元本身
 * 只刷新 updated_at，不会被删掉。
 */
export function deleteTrainingSessionItems(req, res) {
  const body = req.body || {};
  const hasIds = Array.isArray(body.ids) && body.ids.length > 0;
  const hasScope = body.exerciseId != null || body.filter != null;
  if (hasIds && hasScope) {
    return res.status(400).json({
      code: 'SESSION_ITEM_DELETE_SCOPE_INVALID',
      error: 'Provide either session item ids or an exercise scope, not both'
    });
  }
  if (!hasIds && !hasScope) {
    return res.status(400).json({
      code: 'SESSION_ITEM_DELETE_SCOPE_REQUIRED',
      error: 'Session item ids or an exercise scope is required'
    });
  }

  let targets;
  if (hasIds) {
    if (body.ids.length > SESSION_ITEM_DELETE_MAX_IDS) {
      return res.status(400).json({
        code: 'SESSION_ITEM_DELETE_TOO_MANY',
        error: `At most ${SESSION_ITEM_DELETE_MAX_IDS} session items can be deleted at once`,
        details: { max: SESSION_ITEM_DELETE_MAX_IDS }
      });
    }
    if (!body.ids.every((id) => isPositiveInteger(id))) {
      return res.status(400).json({
        code: 'SESSION_ITEM_DELETE_IDS_INVALID',
        error: 'Session item ids must be positive integers'
      });
    }
    const ids = [...new Set(body.ids.map(Number))];
    const items = chunkValues(ids).flatMap((chunk) =>
      queryRows(`${SESSION_ITEM_SELECT} WHERE item.id IN (${chunk.map(() => '?').join(', ')})`, chunk)
    );
    const deletable = items.filter(isDeletable);
    const skipped = items.filter((item) => !isDeletable(item));
    targets = {
      scope: 'ids',
      deletedIds: pickIds(deletable),
      skippedIds: pickIds(skipped),
      skippedCount: skipped.length,
      executionCount: deletable.filter((item) => Number(item.log_item_count) > 0).length
    };
  } else {
    const exerciseId = Number(body.exerciseId);
    if (!isPositiveInteger(exerciseId)) {
      return res.status(400).json({
        code: 'SESSION_ITEM_EXERCISE_REQUIRED',
        error: 'A training exercise is required'
      });
    }
    const validation = validateSessionDeleteFilter(body.filter);
    if (validation.errors) {
      return res.status(400).json({
        code: 'SESSION_FILTER_INVALID',
        error: 'Invalid session filter',
        fields: validation.errors
      });
    }
    const summary = summarizeExerciseDeletion(exerciseId, validation.value);
    if (!summary) {
      return res.status(404).json({
        code: 'SESSION_ITEM_EXERCISE_NOT_FOUND',
        error: 'Training exercise not found'
      });
    }
    // 一个条件都不给等于"把全部训练单元里的这个项目都删掉"。要这么做，也得先把范围收紧到
    // 看得见的那一批（和训练单元的批量删除同一个约定）。
    if (!summary.hasCondition) {
      return res.status(400).json({
        code: 'SESSION_ITEM_FILTER_REQUIRED',
        error: 'At least one filter condition is required'
      });
    }
    const expectedCount = body.expectedCount;
    if (!Number.isInteger(expectedCount) || expectedCount < 0) {
      return res.status(400).json({
        code: 'SESSION_ITEM_DELETE_COUNT_REQUIRED',
        error: 'expectedCount must be a non-negative integer when deleting by exercise scope'
      });
    }
    if (summary.deletableItemCount !== expectedCount) {
      return res.status(409).json({
        code: 'SESSION_ITEM_DELETE_COUNT_CHANGED',
        error: 'The number of training items matching the scope changed',
        details: {
          expectedCount,
          matchedCount: summary.deletableItemCount,
          skippedCount: summary.skippedCount
        }
      });
    }
    targets = {
      scope: 'exercise',
      exerciseId,
      deletedIds: summary.deletableIds,
      skippedIds: summary.skippedIds,
      skippedCount: summary.skippedCount,
      executionCount: summary.executionItemCount
    };
  }

  const db = databaseService.getDb();
  let transactionOpen = false;
  try {
    // 只删确实存在的行：另一个页面可能已经删过它了，这不该让整批回滚。
    const existingItems = chunkValues(targets.deletedIds).flatMap((chunk) => findSessionItems(chunk));
    const existingIds = existingItems.map((item) => Number(item.id));
    const affectedSessionIds = [...new Set(existingItems.map((item) => Number(item.session_id)))];

    db.run('BEGIN IMMEDIATE');
    transactionOpen = true;
    for (const chunk of chunkValues(existingIds)) deleteSessionItems(db, chunk);
    // 单元内容变了，把 updated_at 一起刷新：列表排序、"批量加课"的追加逻辑都看它。
    if (affectedSessionIds.length > 0) {
      const now = Date.now();
      for (const chunk of chunkValues(affectedSessionIds)) {
        db.run(`UPDATE training_sessions SET updated_at = ? WHERE id IN (${chunk.map(() => '?').join(', ')})`, [
          now,
          ...chunk
        ]);
      }
    }
    db.run('COMMIT');
    transactionOpen = false;
    return res.json({
      scope: targets.scope,
      // 被跳过的原因只有一个：删了会让训练单元没有训练内容。
      skipReason: targets.skippedCount > 0 ? 'last_item' : '',
      requestedCount: targets.deletedIds.length,
      deletedIds: existingIds,
      deletedCount: existingIds.length,
      affectedSessionCount: affectedSessionIds.length,
      executionCount: targets.executionCount,
      skippedIds: targets.skippedIds,
      skippedCount: targets.skippedCount
    });
  } catch (error) {
    if (transactionOpen) db.run('ROLLBACK');
    console.error('Error batch deleting training session items:', error);
    return res.status(500).json({ error: 'Failed to batch delete training session items' });
  }
}
