function safeParseJSON(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function isWalkingRecord(record) {
  return [2, 22].includes(record?.sport_type) || ['walking', 'outdoor_walking'].includes(record?.category);
}

export function isEllipticalRecord(record) {
  return record?.sport_type === 11 || ['elliptical', 'elliptical_trainer'].includes(record?.category);
}

export function isRowingRecord(record) {
  return record?.sport_type === 13 || ['rowing', 'rowing_machine'].includes(record?.category);
}

export function filterNightRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return [];

  return records.filter(record => {
    if (!record?.start_time) return false;
    const date = new Date(record.start_time * 1000);
    const hour = date.getHours();
    return hour >= 8 && hour < 23;
  });
}

export function parseSportRecordRow(record, formatter = {}) {
  const value = safeParseJSON(record?.value);
  if (!value) return null;

  const startTime = value.start_time || record.time;
  const endTime = value.end_time || (startTime + (value.duration || 0));
  const duration = value.duration || 0;
  const hrZones = value.hr_zones || {
    warmup: value.warmup_time || 0,
    fatBurn: value.fat_burn_time || 0,
    aerobic: value.aerobic_time || 0,
    anaerobic: value.anaerobic_time || 0,
    extreme: value.extreme_time || 0
  };

  return {
    timeRange: formatter.formatTime ? `${formatter.formatTime(startTime)} - ${formatter.formatTime(endTime)}` : '',
    sport_type: value.sport_type,
    category: record.category || 'other',
    categoryName: formatter.getCategoryName ? formatter.getCategoryName({ sport_type: value.sport_type, category: record.category }) : '',
    duration,
    durationText: formatter.formatDuration ? formatter.formatDuration(duration) : '',
    calories: value.calories || 0,
    distance: value.distance || 0,
    distanceKm: ((value.distance || 0) / 1000).toFixed(2),
    steps: value.steps || 0,
    avgHrm: value.avg_hrm || value.avgHeartRate,
    maxHrm: value.max_hrm || value.maxHeartRate,
    avgSpeed: value.avg_speed ? (value.avg_speed * 3.6).toFixed(2) : null,
    avgPace: value.avg_pace ? Math.floor(value.avg_pace / 60) : null,
    strokes: value.strokes || value.row_count,
    avgStrokeRate: value.avg_stroke_rate || value.avg_row_freq,
    maxStrokeRate: value.max_stroke_rate || value.best_row_freq,
    restTime: value.rest_time || value.rest_between_group_duration || 0,
    segments: Array.isArray(value.segments) ? value.segments : [],
    segmentCount: value.group_count || 0,
    avgPaceSeconds: value.avg_pace_seconds || value.avg_pace,
    bestPaceSeconds: value.best_pace_seconds || value.best_pace,
    avgCadence: value.avg_cadence || value.avg_step_freq,
    maxCadence: value.max_cadence || value.max_step_freq,
    avgStride: value.avg_stride || value.avg_step_length,
    maxStride: value.max_stride || value.max_step_length,
    elevationGain: value.elevation_gain || value.total_ascent,
    kmPaces: Array.isArray(value.km_paces) ? value.km_paces : [],
    hrZones,
    start_time: startTime,
    end_time: endTime
  };
}
