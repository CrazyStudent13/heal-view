/**
 * Parse sport record JSON value field
 * @param {string} jsonString - JSON string
 * @returns {object|null} Parsed object
 */
export function parseSportRecord(jsonString) {
  try {
    if (!jsonString || jsonString === '') return null;

    const parsed = JSON.parse(jsonString);

    return {
      calories: parsed.calories || 0,
      totalCalories: parsed.total_cal || 0,
      duration: parsed.duration || 0, // seconds
      distance: parsed.distance || 0, // meters
      avgHeartRate: parsed.avg_hrm || 0,
      maxHeartRate: parsed.max_hrm || 0,
      avgSpeed: parsed.avg_speed || 0,
      maxSpeed: parsed.max_speed || 0,
      startTime: parsed.start_time,
      endTime: parsed.end_time,
      sportType: parsed.sport_type,
      trainEffect: parsed.train_effect || 0
    };
  } catch (error) {
    console.error('Failed to parse sport record JSON:', error);
    return null;
  }
}

/**
 * Parse weekly report JSON
 * @param {string} jsonString - JSON string
 * @returns {object|null} Parsed object
 */
export function parseWeeklyReport(jsonString) {
  try {
    if (!jsonString) return null;

    const parsed = JSON.parse(jsonString);

    return {
      sportsDuration: parsed.sports_duration?.int_value || 0,
      sportTimes: parsed.sport_times || 0,
      sportDays: parsed.sport_days || 0,
      stepsSummary: parsed.steps_summary?.int_value || 0,
      calorieSummary: parsed.calorie_summary?.int_value || 0,
      sleepReport: parsed.sleep_report || null,
      healthStatus: parsed.hlth_status || null
    };
  } catch (error) {
    console.error('Failed to parse weekly report JSON:', error);
    return null;
  }
}

/**
 * Parse aggregated data JSON (stress, sleep, etc.)
 * @param {string} jsonString - JSON string
 * @returns {object|null} Parsed object
 */
export function parseAggregatedData(jsonString) {
  try {
    if (!jsonString) return null;

    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse aggregated data JSON:', error);
    return null;
  }
}
