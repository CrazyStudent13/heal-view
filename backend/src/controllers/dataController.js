import { databaseService } from '../services/database.js';
import { cacheManager } from '../services/cacheManager.js';
import { config } from '../config/index.js';

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

    // Get steps summary - extract from JSON
    const stepsResult = db.exec(`
      SELECT SUM(CAST(json_extract(value, '$.steps') AS INTEGER)) as total_steps
      FROM fitness_data
      WHERE date = '${date}' AND key = 'steps'
    `);
    const totalSteps = stepsResult.length > 0 ? stepsResult[0].values[0][0] || 0 : 0;

    // Get calories summary - extract from JSON
    const caloriesResult = db.exec(`
      SELECT SUM(CAST(json_extract(value, '$.calories') AS INTEGER)) as total_calories
      FROM fitness_data
      WHERE date = '${date}' AND key = 'calories'
    `);
    const totalCalories = caloriesResult.length > 0 ? caloriesResult[0].values[0][0] || 0 : 0;

    // Get heart rate average - extract from JSON (uses 'bpm' field)
    const hrResult = db.exec(`
      SELECT AVG(CAST(json_extract(value, '$.bpm') AS INTEGER)) as avg_hr, 
             MAX(CAST(json_extract(value, '$.bpm') AS INTEGER)) as max_hr
      FROM fitness_data
      WHERE date = '${date}' AND key = 'heart_rate'
    `);
    const avgHeartRate = hrResult.length > 0 ? Math.round(hrResult[0].values[0][0] || 0) : 0;
    const maxHeartRate = hrResult.length > 0 ? hrResult[0].values[0][1] || 0 : 0;

    // Get stress average - extract from JSON (uses 'stress' field)
    const stressResult = db.exec(`
      SELECT AVG(CAST(json_extract(value, '$.stress') AS INTEGER)) as avg_stress
      FROM fitness_data
      WHERE date = '${date}' AND key = 'stress'
    `);
    const avgStress = stressResult.length > 0 ? Math.round(stressResult[0].values[0][0] || 0) : 0;

    // Get sport records count
    const sportResult = db.exec(`
      SELECT COUNT(*) as count
      FROM sport_records
      WHERE date = '${date}'
    `);
    const sportCount = sportResult.length > 0 ? sportResult[0].values[0][0] : 0;

    const summary = {
      date,
      steps: totalSteps,
      calories: totalCalories,
      avgHeartRate,
      maxHeartRate,
      avgStress,
      sportCount
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

    // Map metric to table and key
    if (['steps', 'calories', 'heart_rate', 'stress'].includes(metric)) {
      tableName = 'fitness_data';
      keyFilter = metric;
    }

    const result = db.exec(`
      SELECT time, value
      FROM ${tableName}
      WHERE date = '${date}' AND key = '${keyFilter}'
      ORDER BY time ASC
    `);

    const data = result.length > 0
      ? result[0].values.map(row => ({
          time: row[0],
          value: parseFloat(row[1]) || 0
        }))
      : [];

    const response = { date, metric, data };

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

    if (startDate) {
      query += ` AND date >= '${startDate}'`;
    }
    if (endDate) {
      query += ` AND date <= '${endDate}'`;
    }
    if (category) {
      query += ` AND category = '${category}'`;
    }

    query += ` ORDER BY time DESC`;

    const result = db.exec(query);

    const records = result.length > 0
      ? result[0].columns.map((col, idx) => col).reduce((acc, col, i) => {
          result[0].values.forEach(row => {
            if (!acc[i]) acc[i] = {};
            acc[i][col] = row[i];
          });
          return acc;
        }, []).map(record => ({
          ...record,
          time: parseInt(record.time),
          date: record.date
        }))
      : [];

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
