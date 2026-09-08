function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function normalizeDate(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function normalizeBloodPressureRecord(record = {}) {
  return {
    time: record.time ?? null,
    systolic: positiveNumber(record.systolic),
    diastolic: positiveNumber(record.diastolic),
    heartRate: record.heartRate === null || record.heartRate === undefined
      ? null
      : positiveNumber(record.heartRate, null)
  };
}

export function normalizeDailySummary(summary = {}, fallbackDate = '') {
  const bloodPressureRecords = Array.isArray(summary.bloodPressureRecords)
    ? summary.bloodPressureRecords.map(normalizeBloodPressureRecord)
    : [];

  return {
    date: normalizeDate(summary.date, fallbackDate),
    steps: positiveNumber(summary.steps),
    distance: positiveNumber(summary.distance),
    calories: positiveNumber(summary.calories),
    avgHeartRate: positiveNumber(summary.avgHeartRate),
    minHeartRate: positiveNumber(summary.minHeartRate),
    maxHeartRate: positiveNumber(summary.maxHeartRate),
    avgStress: positiveNumber(summary.avgStress),
    bloodPressureCount: positiveNumber(summary.bloodPressureCount, bloodPressureRecords.length),
    avgSystolic: positiveNumber(summary.avgSystolic),
    avgDiastolic: positiveNumber(summary.avgDiastolic),
    latestBloodPressure: summary.latestBloodPressure
      ? normalizeBloodPressureRecord(summary.latestBloodPressure)
      : null,
    bloodPressureRecords,
    sleepHours: positiveNumber(summary.sleepHours),
    deepSleepHours: positiveNumber(summary.deepSleepHours),
    lightSleepHours: positiveNumber(summary.lightSleepHours),
    remSleepHours: positiveNumber(summary.remSleepHours),
    awakeSleepHours: positiveNumber(summary.awakeSleepHours),
    totalDurationMinutes: positiveNumber(summary.totalDurationMinutes),
    sportCalories: positiveNumber(summary.sportCalories)
  };
}

export function normalizeSleepTimeline(timeline = null, fallbackDate = '') {
  if (!timeline || typeof timeline !== 'object') return null;

  return {
    ...timeline,
    date: normalizeDate(timeline.date, fallbackDate),
    totalDuration: positiveNumber(timeline.totalDuration),
    avgHeartRate: positiveNumber(timeline.avgHeartRate, null),
    interruptions: positiveNumber(timeline.interruptions),
    bedtime: timeline.bedtime || null,
    wakeUpTime: timeline.wakeUpTime || null,
    segments: Array.isArray(timeline.segments) ? timeline.segments : [],
    heartRateData: Array.isArray(timeline.heartRateData) ? timeline.heartRateData : []
  };
}

export function normalizeWeightData(data = null) {
  if (!data || typeof data !== 'object') return null;

  return {
    ...data,
    dailyData: Array.isArray(data.dailyData)
      ? data.dailyData.map(item => ({
          ...item,
          date: normalizeDate(item.date),
          avgWeight: positiveNumber(item.avgWeight, null)
        })).filter(item => item.date)
      : []
  };
}
