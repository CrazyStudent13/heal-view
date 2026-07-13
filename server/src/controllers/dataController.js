import { databaseService } from '../services/database.js';
import { cacheManager } from '../services/cacheManager.js';
import { config } from '../config/index.js';

function isPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

/**
 * Get list of unique dates (descending order)
 */
export function getDates(req, res) {
  try {
    // Check cache first
    const cached = cacheManager.get('dates_list');
    if (cached) {
      return res.json({ dates: cached });
    }

    const db = databaseService.getDb();

    // Get unique dates from all tables
    const result = db.exec(`
      SELECT DISTINCT date FROM (
        SELECT date FROM fitness_data
        UNION
        SELECT date FROM sport_records
        UNION
        SELECT date FROM aggregated_data
      )
      ORDER BY date DESC
    `);

    const dates = result.length > 0 ? result[0].values.map(row => row[0]) : [];

    // Cache the result
    cacheManager.set('dates_list', dates, config.cacheTTL.dates);

    res.json({ dates });
  } catch (error) {
    console.error('Error getting dates:', error);
    res.status(500).json({ error: 'Failed to fetch dates' });
  }
}

/**
 * Get daily summary for a specific date
 */
export function getDailySummary(req, res) {
  try {
    const { date } = req.params;
    const cacheKey = `summary_${date}`;

    // Check cache
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const db = databaseService.getDb();

    // Get steps summary from aggregated_data table (daily totals)
    // Use MAX to get non-zero values since there may be duplicate records
    const stepsResult = databaseService.query(`
      SELECT 
        MAX(CAST(json_extract(value, '$.steps') AS INTEGER)) as total_steps,
        MAX(CAST(json_extract(value, '$.distance') AS INTEGER)) as total_distance
      FROM aggregated_data
      WHERE date = ? AND key = 'steps'
    `, [date]);
    const totalSteps = stepsResult.length > 0 ? stepsResult[0].values[0][0] || 0 : 0;
    const totalDistance = stepsResult.length > 0 ? stepsResult[0].values[0][1] || 0 : 0;

    // Get calories summary from aggregated_data table (daily totals)
    const caloriesResult = databaseService.query(`
      SELECT CAST(json_extract(value, '$.calories') AS INTEGER) as total_calories
      FROM aggregated_data
      WHERE date = ? AND key = 'steps'
    `, [date]);
    const totalCalories = caloriesResult.length > 0 ? caloriesResult[0].values[0][0] || 0 : 0;

    // Get heart rate metrics - extract from JSON and ignore missing/zero bpm values.
    const hrResult = databaseService.query(`
      SELECT AVG(bpm) as avg_hr,
             MAX(bpm) as max_hr,
             MIN(bpm) as min_hr
      FROM (
        SELECT CAST(json_extract(value, '$.bpm') AS INTEGER) as bpm
        FROM fitness_data
        WHERE date = ? AND key = 'heart_rate'
      )
      WHERE bpm IS NOT NULL AND bpm > 0
    `, [date]);
    const avgHeartRate = hrResult.length > 0 ? Math.round(hrResult[0].values[0][0] || 0) : 0;
    const maxHeartRate = hrResult.length > 0 ? hrResult[0].values[0][1] || 0 : 0;
    const minHeartRate = hrResult.length > 0 ? hrResult[0].values[0][2] || 0 : 0;

    // Get stress average - extract from JSON (uses 'stress' field)
    const stressResult = databaseService.query(`
      SELECT AVG(CAST(json_extract(value, '$.stress') AS INTEGER)) as avg_stress
      FROM fitness_data
      WHERE date = ? AND key = 'stress'
    `, [date]);
    const avgStress = stressResult.length > 0 ? Math.round(stressResult[0].values[0][0] || 0) : 0;

    // Get sleep duration - use MAX to pick the longest sleep record (avoid averaging naps with night sleep)
    const sleepResult = databaseService.query(`
      SELECT 
        MAX(CAST(json_extract(value, '$.duration') AS INTEGER)) as max_sleep,
        MAX(CAST(json_extract(value, '$.sleep_deep_duration') AS INTEGER)) as max_deep_sleep,
        MAX(CAST(json_extract(value, '$.sleep_light_duration') AS INTEGER)) as max_light_sleep,
        MAX(CAST(json_extract(value, '$.sleep_rem_duration') AS INTEGER)) as max_rem_sleep,
        MAX(CAST(json_extract(value, '$.sleep_awake_duration') AS INTEGER)) as max_awake_sleep
      FROM fitness_data
      WHERE date = ? AND key = 'sleep'
    `, [date]);
    const totalSleepMinutes = sleepResult.length > 0 ? sleepResult[0].values[0][0] || 0 : 0;
    const totalDeepSleepMinutes = sleepResult.length > 0 ? sleepResult[0].values[0][1] || 0 : 0;
    const totalLightSleepMinutes = sleepResult.length > 0 ? sleepResult[0].values[0][2] || 0 : 0;
    const totalRemSleepMinutes = sleepResult.length > 0 ? sleepResult[0].values[0][3] || 0 : 0;
    const totalAwakeSleepMinutes = sleepResult.length > 0 ? sleepResult[0].values[0][4] || 0 : 0;
    
    // Convert to hours with 1 decimal place
    const sleepHours = totalSleepMinutes > 0 ? (totalSleepMinutes / 60).toFixed(1) : 0;
    const deepSleepHours = totalDeepSleepMinutes > 0 ? (totalDeepSleepMinutes / 60).toFixed(1) : 0;
    const lightSleepHours = totalLightSleepMinutes > 0 ? (totalLightSleepMinutes / 60).toFixed(1) : 0;
    const remSleepHours = totalRemSleepMinutes > 0 ? (totalRemSleepMinutes / 60).toFixed(1) : 0;
    const awakeSleepHours = totalAwakeSleepMinutes > 0 ? (totalAwakeSleepMinutes / 60).toFixed(1) : 0;

    // Get sport records count, total duration, and total calories
    const sportResult = db.exec(`
      SELECT 
        COUNT(*) as count,
        SUM(CAST(json_extract(value, '$.duration') AS INTEGER)) as total_duration_seconds,
        SUM(CAST(json_extract(value, '$.calories') AS INTEGER)) as total_calories
      FROM sport_records
      WHERE date = '${date}'
    `);
    const sportCount = sportResult.length > 0 ? sportResult[0].values[0][0] : 0;
    const totalDurationSeconds = sportResult.length > 0 ? (sportResult[0].values[0][1] || 0) : 0;
    const totalDurationMinutes = Math.round(totalDurationSeconds / 60);
    const sportCalories = sportResult.length > 0 ? (sportResult[0].values[0][2] || 0) : 0;

    const summary = {
      date,
      steps: totalSteps,
      distance: totalDistance,
      calories: totalCalories,
      avgHeartRate,
      minHeartRate,
      maxHeartRate,
      avgStress,
      sleepHours: parseFloat(sleepHours),
      deepSleepHours: parseFloat(deepSleepHours),
      lightSleepHours: parseFloat(lightSleepHours),
      remSleepHours: parseFloat(remSleepHours),
      awakeSleepHours: parseFloat(awakeSleepHours),
      sportCount,
      totalDurationMinutes,
      sportCalories
    };

    // Cache the result
    cacheManager.set(cacheKey, summary, config.cacheTTL.summary);

    res.json(summary);
  } catch (error) {
    console.error('Error getting daily summary:', error);
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
}

/**
 * Get time series data for a specific metric and date
 */
export function getTimeSeries(req, res) {
  try {
    const { date, metric } = req.params;
    const cacheKey = `timeseries_${date}_${metric}`;

    // Check cache
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const db = databaseService.getDb();

    let tableName = 'fitness_data';
    let keyFilter = metric;

    // Map metric to table and key (whitelist validation prevents injection)
    if (['steps', 'calories', 'heart_rate', 'stress'].includes(metric)) {
      tableName = 'fitness_data';
      keyFilter = metric;
    }

    const heartRateFilter = metric === 'heart_rate'
      ? ` AND CAST(json_extract(value, '$.bpm') AS REAL) > 0`
      : '';

    const result = databaseService.query(`
      SELECT time, value
      FROM ${tableName}
      WHERE date = ? AND key = ?
      ${heartRateFilter}
      ORDER BY time ASC
    `, [date, keyFilter]);

    const data = result.length > 0
      ? result[0].values.map(row => {
          // Parse JSON value for metrics that store data in JSON format
          let value;
          try {
            const jsonValue = typeof row[1] === 'string' ? JSON.parse(row[1]) : row[1];
            
            // Extract the appropriate field based on metric type
            if (metric === 'heart_rate') {
              value = isPositiveNumber(jsonValue.bpm) ? Number(jsonValue.bpm) : null;
            } else if (metric === 'stress') {
              value = jsonValue.stress || 0;
            } else if (metric === 'steps') {
              value = jsonValue.steps || 0;
            } else if (metric === 'calories') {
              value = jsonValue.calories || 0;
            } else {
              // For other metrics, try to parse as number or use default
              value = parseFloat(jsonValue) || 0;
            }
          } catch (e) {
            // If parsing fails, try to parse as float directly
            const parsed = parseFloat(row[1]);
            value = metric === 'heart_rate'
              ? (isPositiveNumber(parsed) ? parsed : null)
              : (parsed || 0);
          }
          
          return {
            time: row[0],
            value: value
          };
        })
      : [];

    const filteredData = metric === 'heart_rate'
      ? data.filter(item => isPositiveNumber(item.value))
      : data;

    // Remove duplicates - keep only unique time entries
    const seen = new Set();
    const uniqueData = filteredData.filter(item => {
      if (seen.has(item.time)) {
        return false;
      }
      seen.add(item.time);
      return true;
    });

    const response = { date, metric, data: uniqueData };

    // Cache the result
    cacheManager.set(cacheKey, response, config.cacheTTL.summary);

    res.json(response);
  } catch (error) {
    console.error('Error getting time series:', error);
    res.status(500).json({ error: 'Failed to fetch time series data' });
  }
}

/**
 * Get sport records with optional filters
 */
export function getSportRecords(req, res) {
  try {
    const { startDate, endDate, category } = req.query;
    const cacheKey = `sports_${startDate}_${endDate}_${category || 'all'}`;

    // Check cache
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const db = databaseService.getDb();

    let query = `SELECT * FROM sport_records WHERE 1=1`;
    const params = [];

    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }
    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY time DESC`;

    const result = databaseService.query(query, params);

    let records = result.length > 0
      ? result[0].values.map(row => {
          const record = {};
          result[0].columns.forEach((col, idx) => {
            record[col] = row[idx];
          });
          return {
            ...record,
            time: parseInt(record.time) || null,
            date: record.date
          };
        })
      : [];

    // Remove duplicates based on start_time and category
    const seen = new Set();
    records = records.filter(record => {
      try {
        const value = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
        const startTime = value.start_time || record.time;
        const category = record.category || '';
        const key = `${startTime}_${category}`;
        
        if (seen.has(key)) {
          return false; // Duplicate
        }
        seen.add(key);
        return true; // Unique
      } catch (error) {
        return true; // Keep record if parsing fails
      }
    });

    const response = { records };

    // Cache the result
    cacheManager.set(cacheKey, response, config.cacheTTL.summary);

    res.json(response);
  } catch (error) {
    console.error('Error getting sport records:', error);
    res.status(500).json({ error: 'Failed to fetch sport records' });
  }
}

/**
 * Get filter options (sport types, etc.)
 */
export function getFilterOptions(req, res) {
  try {
    const cacheKey = 'filter_options';

    // Check cache
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const db = databaseService.getDb();

    // Get unique sport categories
    const sportTypesResult = db.exec(`
      SELECT DISTINCT category
      FROM sport_records
      ORDER BY category
    `);
    const sportTypes = sportTypesResult.length > 0
      ? sportTypesResult[0].values.map(row => row[0])
      : [];

    const options = {
      sportTypes
    };

    // Cache the result
    cacheManager.set(cacheKey, options, config.cacheTTL.dates);

    res.json(options);
  } catch (error) {
    console.error('Error getting filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
}

/**
 * Get sleep timeline for a specific date
 */
export function getSleepTimeline(req, res) {
  try {
    const { date } = req.params;
    const cacheKey = `sleep_timeline_${date}`;

    // Check cache
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const db = databaseService.getDb();

    // Get ALL sleep records for the date (may have multiple: nap + night sleep)
    const result = databaseService.query(`
      SELECT value FROM fitness_data
      WHERE date = ? AND key = 'sleep'
    `, [date]);

    if (result.length === 0 || result[0].values.length === 0) {
      return res.json({
        date,
        bedtime: null,
        wakeUpTime: null,
        totalDuration: 0,
        segments: []
      });
    }

    // Parse all records and pick the one with the most items (detailed sleep data)
    let bestSleepData = null;
    let maxItems = -1;
    for (const row of result[0].values) {
      try {
        const parsed = JSON.parse(row[0]);
        const itemCount = (parsed.items && parsed.items.length) || 0;
        if (itemCount > maxItems) {
          maxItems = itemCount;
          bestSleepData = parsed;
        }
      } catch (e) {
        // Skip malformed records
      }
    }

    if (!bestSleepData) {
      return res.json({
        date,
        bedtime: null,
        wakeUpTime: null,
        totalDuration: 0,
        segments: []
      });
    }

    const sleepData = bestSleepData;

    if (!sleepData.items || sleepData.items.length === 0) {
      return res.json({
        date,
        bedtime: null,
        wakeUpTime: null,
        totalDuration: sleepData.duration || 0,
        segments: []
      });
    }

    // State mapping: 2=deep, 3=light, 4=rem, 5=awake
    const stateMap = {
      2: 'deep',
      3: 'light',
      4: 'rem',
      5: 'awake'
    };

    // Convert items to segments with formatted time
    const segments = sleepData.items.map(item => {
      const startDate = new Date(item.start_time * 1000);
      const endDate = new Date(item.end_time * 1000);
      const duration = Math.round((item.end_time - item.start_time) / 60); // in minutes

      return {
        startTime: startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        endTime: endDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        state: stateMap[item.state] || 'unknown',
        duration: duration,
        startTimestamp: item.start_time,
        endTimestamp: item.end_time
      };
    });

    // Format bedtime and wakeUpTime
    const bedtime = sleepData.bedtime ? new Date(sleepData.bedtime * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
    const wakeUpTime = sleepData.wake_up_time ? new Date(sleepData.wake_up_time * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;

    const timeline = {
      date,
      bedtime,
      wakeUpTime,
      totalDuration: sleepData.duration || 0,
      segments
    };

    // Cache the result
    cacheManager.set(cacheKey, timeline, config.cacheTTL.summary);

    res.json(timeline);
  } catch (error) {
    console.error('Error getting sleep timeline:', error);
    res.status(500).json({ error: 'Failed to fetch sleep timeline' });
  }
}
