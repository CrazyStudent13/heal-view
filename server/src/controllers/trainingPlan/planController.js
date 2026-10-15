// 训练计划本体的列表、详情与增删改。
import { summarizeCoverage, summarizeItemResults } from '../../services/aerobicMatching.js';
import { loadNormalizedSportRecords, todayDateKey } from '../../services/sportRecordRepository.js';
import { databaseService } from '../../services/database.js';
import { queryRow, queryRows } from './queryHelpers.js';
import { computePlanStats } from './planStats.js';
import { deriveSessionStatus, evaluateAutoMatches } from './sessionStatus.js';
import { getPlan, getPlanRow, saveSessionItems, validateExercises } from './planRepository.js';
import { respondConflict } from './responses.js';
import { serializeItem, serializePhase, serializePlan, serializeSession } from './serializers.js';
import { validatePlanPayload, validateSessionPayload } from './validation.js';

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
