// 训练阶段的增删改。
import { databaseService } from '../../services/database.js';
import { queryRow } from './queryHelpers.js';
import { getPhase, getPlan, validatePhaseWithinPlan } from './planRepository.js';
import { respondConflict } from './responses.js';
import { validatePhasePayload } from './validation.js';

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
