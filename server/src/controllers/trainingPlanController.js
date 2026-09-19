import { databaseService } from '../services/database.js';

const PLAN_STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'archived']);
const PHASE_STATUSES = new Set(['planned', 'active', 'paused', 'completed', 'cancelled']);
const SESSION_STATUSES = new Set(['planned', 'achieved', 'partial', 'no_data', 'unverifiable', 'skipped']);
const TARGET_METRICS = new Set([
  'duration',
  'distance',
  'sets',
  'repetitions',
  'weight',
  'speed',
  'incline',
  'resistance',
  'heart_rate',
  'calories'
]);
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
    status: payload.status || 'draft',
    notes: text(payload.notes, 2000)
  };
  const errors = {};
  if (!value.name) errors.name = 'Name is required and must be 100 characters or fewer';
  if (value.goal === null) errors.goal = 'Goal must be 1000 characters or fewer';
  if (value.notes === null) errors.notes = 'Notes must be 2000 characters or fewer';
  if (!PLAN_STATUSES.has(value.status)) errors.status = 'Invalid plan status';
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
  for (const [metric, rawValue] of Object.entries(targets)) {
    const number = Number(rawValue);
    if (!TARGET_METRICS.has(metric) || !Number.isFinite(number) || number <= 0) return null;
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

function serializePlan(row) {
  return {
    id: Number(row.id),
    name: row.name,
    goal: row.goal || '',
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    notes: row.notes || '',
    phaseCount: row.phase_count == null ? undefined : Number(row.phase_count),
    sessionCount: row.session_count == null ? undefined : Number(row.session_count),
    trainingDayCount: row.training_day_count == null ? undefined : Number(row.training_day_count),
    completedTrainingDayCount:
      row.completed_training_day_count == null ? undefined : Number(row.completed_training_day_count),
    phaseName: row.phase_name || '',
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function serializePhase(row) {
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
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function serializeSession(row) {
  return {
    id: Number(row.id),
    planId: Number(row.plan_id),
    scheduledDate: row.scheduled_date,
    sequence: Number(row.sequence),
    name: row.name || '',
    notes: row.notes || '',
    status: row.status,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function serializeSessionListItem(row) {
  return {
    ...serializeSession(row),
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
      metrics: parseJson(row.exercise_metrics, [])
    }
  };
}

function getPlan(id) {
  const row = queryRow('SELECT * FROM training_plans WHERE id = ?', [id]);
  return row ? serializePlan(row) : null;
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
    if (Object.keys(item.targets).some((metric) => !supportedMetrics.has(metric))) {
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
    const rows = queryRows(`
      SELECT p.*,
        COUNT(DISTINCT ph.id) AS phase_count,
        COUNT(DISTINCT s.id) AS session_count,
        COUNT(DISTINCT s.scheduled_date) AS training_day_count,
        COUNT(DISTINCT CASE WHEN s.status IN ('achieved', 'partial') THEN s.scheduled_date END) AS completed_training_day_count,
        (
          SELECT phase.name
          FROM training_phases phase
          WHERE phase.plan_id = p.id
          ORDER BY
            CASE
              WHEN date('now') BETWEEN phase.start_date AND phase.end_date THEN 0
              WHEN phase.start_date > date('now') THEN 1
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
      GROUP BY p.id
      ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,
        p.start_date DESC, p.id DESC
    `);
    return res.json({ plans: rows.map(serializePlan) });
  } catch (error) {
    console.error('Error listing training plans:', error);
    return res.status(500).json({ error: 'Failed to fetch training plans' });
  }
}

export function listTrainingSessions(req, res) {
  try {
    const { startDate, endDate, planId, status } = req.query;
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
    if (SESSION_STATUSES.has(status)) {
      conditions.push('s.status = ?');
      params.push(status);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = queryRows(
      `SELECT s.*, p.name AS plan_name,
        (SELECT COUNT(*) FROM training_session_items item_count WHERE item_count.session_id = s.id) AS item_count,
        (SELECT COALESCE(json_group_array(json_object('name', exercise.name, 'targets', json(item.targets))), '[]')
          FROM training_session_items item
          JOIN training_exercises exercise ON exercise.id = item.exercise_id
          WHERE item.session_id = s.id) AS exercises
       FROM training_sessions s
       JOIN training_plans p ON p.id = s.plan_id
       ${whereClause}
       ORDER BY s.scheduled_date DESC, s.sequence ASC, s.id DESC`,
      params
    );
    return res.json({ sessions: rows.map(serializeSessionListItem) });
  } catch (error) {
    console.error('Error listing training sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch training sessions' });
  }
}

export function getTrainingPlan(req, res) {
  try {
    const plan = getPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ error: 'Training plan not found' });
    const phases = queryRows('SELECT * FROM training_phases WHERE plan_id = ? ORDER BY position, start_date, id', [
      plan.id
    ]).map(serializePhase);
    const sessions = queryRows(
      'SELECT * FROM training_sessions WHERE plan_id = ? ORDER BY scheduled_date, sequence, id',
      [plan.id]
    ).map(serializeSession);
    const sessionIds = sessions.map((session) => session.id);
    const items =
      sessionIds.length === 0
        ? []
        : queryRows(
            `SELECT i.*, e.name AS exercise_name, e.icon AS exercise_icon,
              e.category AS exercise_category, e.metrics AS exercise_metrics
             FROM training_session_items i
             JOIN training_exercises e ON e.id = i.exercise_id
             WHERE i.session_id IN (${sessionIds.map(() => '?').join(', ')})
             ORDER BY i.position, i.id`,
            sessionIds
          ).map(serializeItem);

    const itemsBySession = Map.groupBy(items, (item) => item.sessionId);
    return res.json({
      ...plan,
      phases,
      sessions: sessions.map((session) => ({ ...session, items: itemsBySession.get(session.id) || [] }))
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
      `INSERT INTO training_plans (name, goal, start_date, end_date, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [value.name, value.goal, value.startDate, value.endDate, value.status, value.notes, now, now]
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
      `INSERT INTO training_plans (name, goal, start_date, end_date, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [plan.name, plan.goal, plan.startDate, plan.endDate, plan.status, plan.notes, now, now]
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
    if (!getPlan(id)) return res.status(404).json({ error: 'Training plan not found' });
    const value = validation.value;
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
      `UPDATE training_plans SET name = ?, goal = ?, start_date = ?, end_date = ?, status = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [value.name, value.goal, value.startDate, value.endDate, value.status, value.notes, Date.now(), id]
    );
    return res.json(getPlan(id));
  } catch (error) {
    console.error('Error updating training plan:', error);
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

function saveSessionItems(db, sessionId, items, now) {
  items.forEach((item, index) => {
    db.run(
      `INSERT INTO training_session_items
        (session_id, exercise_id, position, verification_mode, targets, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, item.exerciseId, index, item.verificationMode, JSON.stringify(item.targets), now, now]
    );
  });
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
  validateSessionPayload
};
