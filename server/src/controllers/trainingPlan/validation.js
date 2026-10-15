// 计划、阶段、课次、阶段复盘的入参校验。
// 校验文案与字段名是接口契约（错误响应的 fields 直接回给前端），改动前先看对应的测试。
import { isTrainingMetric } from '../../utils/trainingMetrics.js';

const PHASE_STATUSES = new Set(['planned', 'active', 'paused', 'completed', 'cancelled']);
const SESSION_STATUSES = new Set(['planned', 'achieved', 'partial', 'no_data', 'unverifiable', 'skipped']);

const MAX_FATIGUE_LEVEL = 10;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value) {
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

export function validatePlanPayload(payload = {}) {
  const value = {
    name: text(payload.name, 100),
    goal: text(payload.goal, 1000),
    startDate: payload.startDate,
    endDate: payload.endDate,
    notes: text(payload.notes, 2000)
  };
  const errors = {};
  if (!value.name) errors.name = 'Name is required and must be 100 characters or fewer';
  if (value.goal === null) errors.goal = 'Goal must be 1000 characters or fewer';
  if (value.notes === null) errors.notes = 'Notes must be 2000 characters or fewer';
  validateDateRange(value.startDate, value.endDate, errors);
  return Object.keys(errors).length > 0 ? { errors } : { value };
}

export function validatePhasePayload(payload = {}) {
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
  if (targets.duration != null && targets.durationSeconds != null) return null;
  for (const [metric, rawValue] of Object.entries(targets)) {
    const number = Number(rawValue);
    if (!isTrainingMetric(metric) || !Number.isFinite(number) || number <= 0) return null;
    if (metric === 'durationSeconds' && !Number.isInteger(number)) return null;
    normalized[metric] = number;
  }
  return normalized;
}

export function validateSessionPayload(payload = {}) {
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

export function validatePhaseReviewPayload(payload = {}) {
  const rawFatigue = payload.fatigueLevel;
  const rawWeightChange = payload.weightChange;
  const fatigueLevel = rawFatigue === '' || rawFatigue == null ? null : Number(rawFatigue);
  const weightChange = rawWeightChange === '' || rawWeightChange == null ? null : Number(rawWeightChange);
  const value = {
    summary: text(payload.summary, 4000),
    fatigueLevel,
    discomfort: text(payload.discomfort, 2000),
    weightChange,
    adjustment: text(payload.adjustment, 2000)
  };
  const errors = {};
  if (value.summary === null) errors.summary = 'Summary must be 4000 characters or fewer';
  if (value.discomfort === null) errors.discomfort = 'Discomfort must be 2000 characters or fewer';
  if (value.adjustment === null) errors.adjustment = 'Adjustment must be 2000 characters or fewer';
  if (
    fatigueLevel !== null &&
    (!Number.isInteger(fatigueLevel) || fatigueLevel < 0 || fatigueLevel > MAX_FATIGUE_LEVEL)
  ) {
    errors.fatigueLevel = 'Fatigue level must be an integer from 0 to 10';
  }
  if (fatigueLevel !== null && fatigueLevel > 6) {
    if (!value.discomfort) errors.discomfort = 'Discomfort is required above fatigue level 6';
    if (!value.adjustment) errors.adjustment = 'Adjustment is required above fatigue level 6';
  }
  if (weightChange !== null && (!Number.isFinite(weightChange) || weightChange < -100 || weightChange > 100)) {
    errors.weightChange = 'Weight change must be between -100 and 100';
  }
  return Object.keys(errors).length > 0 ? { errors } : { value };
}
