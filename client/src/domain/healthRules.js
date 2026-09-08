const MINUTES_PER_DAY = 24 * 60;

export const SLEEP_REGULARITY_STATUS = {
  NONE: 'none',
  REGULAR: 'regular',
  MIXED: 'mixed',
  CHAOTIC: 'chaotic'
};

export const BLOOD_PRESSURE_STATUS = {
  NORMAL: 'normal',
  ELEVATED: 'elevated',
  HIGH: 'high'
};

function parseTimeToMinutes(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return (hours * 60 + minutes) % MINUTES_PER_DAY;
}

function formatMinutesToTime(minutes) {
  if (!Number.isFinite(minutes)) return '--';
  const value = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = String(Math.floor(value / 60)).padStart(2, '0');
  const mins = String(value % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

function circularDistance(a, b) {
  const diff = Math.abs(a - b) % MINUTES_PER_DAY;
  return Math.min(diff, MINUTES_PER_DAY - diff);
}

function circularMean(values) {
  if (!values.length) return null;

  let sinSum = 0;
  let cosSum = 0;
  values.forEach((value) => {
    const angle = (value / MINUTES_PER_DAY) * Math.PI * 2;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  });

  if (sinSum === 0 && cosSum === 0) return null;

  let angle = Math.atan2(sinSum / values.length, cosSum / values.length);
  if (angle < 0) angle += Math.PI * 2;
  return (angle / (Math.PI * 2)) * MINUTES_PER_DAY;
}

export function assessSleepRegularity(times, options = {}) {
  const {
    toleranceMinutes = 90,
    regularScore = 7,
    mixedScore = 4
  } = options;

  const validTimes = times
    .map(parseTimeToMinutes)
    .filter(value => Number.isFinite(value));

  if (validTimes.length === 0) {
    return {
      score: null,
      matched: 0,
      total: 0,
      referenceTime: '--',
      status: SLEEP_REGULARITY_STATUS.NONE
    };
  }

  const reference = circularMean(validTimes);
  const referenceTime = reference === null ? '--' : formatMinutesToTime(reference);
  const matched = validTimes.filter(value => circularDistance(value, reference) <= toleranceMinutes).length;
  const score = Math.round((matched / validTimes.length) * 100) / 10;

  let status = SLEEP_REGULARITY_STATUS.CHAOTIC;
  if (score >= regularScore) status = SLEEP_REGULARITY_STATUS.REGULAR;
  else if (score >= mixedScore) status = SLEEP_REGULARITY_STATUS.MIXED;

  return {
    score,
    matched,
    total: validTimes.length,
    referenceTime,
    status
  };
}

export function classifyBloodPressure(systolic, diastolic) {
  const sys = Number(systolic) || 0;
  const dia = Number(diastolic) || 0;

  if (sys >= 140 || dia >= 90) return BLOOD_PRESSURE_STATUS.HIGH;
  if (sys >= 130 || dia >= 85) return BLOOD_PRESSURE_STATUS.ELEVATED;
  return BLOOD_PRESSURE_STATUS.NORMAL;
}

export function classifyBloodPressureRecord(record) {
  if (!record) return BLOOD_PRESSURE_STATUS.NORMAL;

  return classifyBloodPressure(
    record.latestSystolic ?? record.systolic,
    record.latestDiastolic ?? record.diastolic
  );
}

export function calculateCalorieEfficiency(calories, durationMinutes) {
  const caloriesValue = Number(calories || 0);
  const durationValue = Number(durationMinutes || 0);

  return durationValue > 0 && caloriesValue > 0
    ? Math.round((caloriesValue / durationValue) * 100) / 100
    : null;
}
