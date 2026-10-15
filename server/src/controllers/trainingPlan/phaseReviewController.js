// 阶段复盘的读取与保存（每个阶段一条，保存走 upsert）。
import { databaseService } from '../../services/database.js';
import { queryRow } from './queryHelpers.js';
import { getPhase } from './planRepository.js';
import { getPhaseExecutionSummary, serializePhaseReview } from './serializers.js';
import { validatePhaseReviewPayload } from './validation.js';

export function getTrainingPhaseReview(req, res) {
  try {
    const phase = getPhase(Number(req.params.id));
    if (!phase) return res.status(404).json({ error: 'Training phase not found' });
    return res.json({
      phaseId: phase.id,
      review: phase.review,
      executionSummary: phase.executionSummary
    });
  } catch (error) {
    console.error('Error getting training phase review:', error);
    return res.status(500).json({ error: 'Failed to fetch training phase review' });
  }
}

export function saveTrainingPhaseReview(req, res) {
  const validation = validatePhaseReviewPayload(req.body);
  if (validation.errors) {
    return res.status(400).json({ error: 'Invalid training phase review', fields: validation.errors });
  }
  try {
    const phase = getPhase(Number(req.params.id));
    if (!phase) return res.status(404).json({ error: 'Training phase not found' });
    const value = validation.value;
    const now = Date.now();
    databaseService.getDb().run(
      `INSERT INTO training_phase_reviews
        (phase_id, summary, fatigue_level, discomfort, weight_change, adjustment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(phase_id) DO UPDATE SET
         summary = excluded.summary,
         fatigue_level = excluded.fatigue_level,
         discomfort = excluded.discomfort,
         weight_change = excluded.weight_change,
         adjustment = excluded.adjustment,
         updated_at = excluded.updated_at`,
      [phase.id, value.summary, value.fatigueLevel, value.discomfort, value.weightChange, value.adjustment, now, now]
    );
    const review = serializePhaseReview(
      queryRow('SELECT * FROM training_phase_reviews WHERE phase_id = ?', [phase.id])
    );
    return res.json({
      phaseId: phase.id,
      review,
      executionSummary: getPhaseExecutionSummary(phase.id, phase.planId, phase.startDate, phase.endDate)
    });
  } catch (error) {
    console.error('Error saving training phase review:', error);
    return res.status(500).json({ error: 'Failed to save training phase review' });
  }
}
