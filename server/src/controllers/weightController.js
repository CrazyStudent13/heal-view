import { databaseService } from '../services/database.js';
import { cacheManager } from '../services/cacheManager.js';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '../../../data');

// Cached user profile data (loaded once at startup)
let userProfile = null;

export function resetUserProfileCache() {
  userProfile = null;
}

/**
 * Load user profile from CSV files
 */
async function loadUserProfile() {
  if (userProfile) return userProfile;

  // Default profile: used when no profile CSV is present (e.g. data/ cleaned),
  // so the profile/weight endpoints degrade gracefully instead of erroring.
  userProfile = { height: 0, sex: 'male', birth: '' };

  try {
    const importedProfile = databaseService.query(`
      SELECT value FROM fitness_data
      WHERE key = 'user_profile'
      ORDER BY update_time DESC, id DESC
      LIMIT 1
    `);

    if (importedProfile.length > 0) {
      const profile = JSON.parse(importedProfile[0].values[0][0]);
      userProfile = {
        height: parseFloat(profile.heightCm) || 0,
        sex: profile.sex || 'male',
        birth: profile.birthDate || '',
        currentWeight: parseFloat(profile.initialWeightKg) || 0,
        initialWeight: parseFloat(profile.initialWeightKg) || null,
        targetWeight: parseFloat(profile.targetWeightKg) || null,
        dailyCalGoal: parseInt(profile.dailyCalorieGoal) || 700,
        vo2Max: parseInt(profile.vo2Max) || 0
      };
      return userProfile;
    }
  } catch (error) {
    console.warn('Imported user profile unavailable:', error.message);
  }

  try {
    // Read user_member_profile.csv for height, sex, birth
    const memberFile = fs.readdirSync(dataDir).find(f => f.includes('user_member_profile'));
    if (memberFile) {
      const memberRows = await new Promise((resolve) => {
        const results = [];
        fs.createReadStream(path.join(dataDir, memberFile))
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results));
      });
      if (memberRows.length > 0) {
        const row = memberRows[0];
        userProfile = {
          height: parseFloat(row.Height) || 0,   // cm
          sex: row.Sex || 'male',
          birth: row.Birth || '',
          currentWeight: parseFloat(row.Weight) || 0
        };
      }
    }

    // Read user_fitness_profile.csv for target weight / calorie goal
    const profileFile = fs.readdirSync(dataDir).find(f => f.includes('user_fitness_profile'));
    if (profileFile && userProfile) {
      const profileRows = await new Promise((resolve) => {
        const results = [];
        fs.createReadStream(path.join(dataDir, profileFile))
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results));
      });
      if (profileRows.length > 0) {
        const row = profileRows[0];
        userProfile.dailyCalGoal = parseInt(row.DailyCalGoal) || 700;

        // Parse initial weight
        try {
          const initialWeight = JSON.parse(row.InitialWeight);
          userProfile.initialWeight = initialWeight.weight || null;
        } catch (e) {
          userProfile.initialWeight = null;
        }

        // Parse RegularGoalList for target BMI (field:4) or target weight
        try {
          const goals = JSON.parse(row.RegularGoalList);
          const weightGoal = goals.find(g => g.field === 4); // field:4 seems to be BMI/weight goal
          if (weightGoal && weightGoal.target && userProfile.height > 0) {
            // Target is likely BMI, calculate target weight
            const heightM = userProfile.height / 100;
            const targetBMI = weightGoal.target;
            userProfile.targetWeight = parseFloat((targetBMI * heightM * heightM).toFixed(1));
            userProfile.targetBMI = weightGoal.target;
          }
        } catch (e) {
          // Ignore parse error for goals
        }

        userProfile.vo2Max = parseInt(row.Vo2Max) || 0;
      }
    }

    console.log('User profile loaded:', JSON.stringify(userProfile, null, 2));
  } catch (error) {
    console.error('Error loading user profile:', error);
    userProfile = { height: 0, sex: 'male', birth: '' };
  }

  return userProfile;
}

/**
 * Calculate BMI: weight(kg) / height(m)^2
 */
function calculateBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

/**
 * Calculate BMR using Mifflin-St Jeor equation
 */
function calculateBMR(weightKg, heightCm, age, sex) {
  if (!weightKg || !heightCm || !age) return 0;
  if (sex === 'male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  } else {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
}

/**
 * Calculate age from birth date string (YYYY-MM-DD)
 */
function calculateAge(birthStr) {
  if (!birthStr) return 0;
  const birth = new Date(birthStr);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * GET /api/weight/data
 * Query params: startDate, endDate (optional, for filtering chart data)
 */
export async function getWeightData(req, res) {
  try {
    const { startDate, endDate } = req.query;
    const cacheKey = `weight_data_${startDate || 'all'}_${endDate || 'all'}`;

    // Check cache
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Load user profile
    const profile = await loadUserProfile();

    const db = databaseService.getDb();

    // Query all weight records, get daily average
    let query = `
      SELECT date, AVG(CAST(json_extract(value, '$.weight') AS REAL)) as avg_weight,
             COUNT(*) as record_count
      FROM fitness_data
      WHERE key = 'weight'
    `;
    const params = [];
    if (startDate) {
      query += ` AND date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND date <= ?`;
      params.push(endDate);
    }
    query += ` GROUP BY date ORDER BY date ASC`;

    const weightResult = databaseService.query(query, params);

    const dailyData = [];
    if (weightResult.length > 0) {
      for (const row of weightResult[0].values) {
        dailyData.push({
          date: row[0],
          avgWeight: parseFloat(row[1].toFixed(1)),
          recordCount: row[2]
        });
      }
    }

    // Calculate metrics
    const allDates = dailyData.map(d => d.date);
    const allWeights = dailyData.map(d => d.avgWeight);

    // Latest weight
    const latestWeight = allWeights.length > 0 ? allWeights[allWeights.length - 1] : 0;

    // BMI (calculated from latest weight)
    const bmi = calculateBMI(latestWeight, profile.height);

    // Highest weight in history (with date)
    let highestWeight = { weight: 0, date: '' };
    if (dailyData.length > 0) {
      const maxItem = dailyData.reduce((max, item) => item.avgWeight > max.avgWeight ? item : max, dailyData[0]);
      highestWeight = { weight: maxItem.avgWeight, date: maxItem.date };
    }

    // Weight change (first to last in range)
    const weightChange = allWeights.length >= 2
      ? parseFloat((allWeights[allWeights.length - 1] - allWeights[0]).toFixed(1))
      : 0;

    // Target weight
    const targetWeight = profile.targetWeight || null;

    // BMI reference table based on user's height
    const heightM = profile.height / 100;
    const bmiReference = profile.height > 0 ? {
      underweight: { bmi: 18.5, weight: parseFloat((18.5 * heightM * heightM).toFixed(1)) },
      normal: { bmi: 24, weight: parseFloat((24 * heightM * heightM).toFixed(1)) },
      overweight: { bmi: 28, weight: parseFloat((28 * heightM * heightM).toFixed(1)) },
      userHeight: profile.height
    } : null;

    // Average daily calories (BMR + avg sport calories)
    const age = calculateAge(profile.birth);
    const bmr = calculateBMR(latestWeight || profile.currentWeight, profile.height, age, profile.sex);

    // Get average sport calories for the date range
    let avgSportCalories = 0;
    let sportQuery = `
      SELECT AVG(calorie_avg) as avg_cal
      FROM (
        SELECT date, SUM(CAST(json_extract(value, '$.calories') AS INTEGER)) as calorie_avg
        FROM sport_records
        WHERE 1=1
    `;
    const sportParams = [];
    if (startDate) { sportQuery += ` AND date >= ?`; sportParams.push(startDate); }
    if (endDate) { sportQuery += ` AND date <= ?`; sportParams.push(endDate); }
    sportQuery += ` GROUP BY date )`;
    
    const sportResult = databaseService.query(sportQuery, sportParams);
    if (sportResult.length > 0 && sportResult[0].values[0][0]) {
      avgSportCalories = Math.round(sportResult[0].values[0][0]);
    }

    const avgDailyCalories = bmr + avgSportCalories;

    const response = {
      dailyData,
      metrics: {
        latestWeight,
        bmi,
        initialWeight: profile.initialWeight || null,
        targetWeight,
        targetBMI: profile.targetBMI || null,
        highestWeight,
        weightChange,
        avgDailyCalories,
        bmr,
        avgSportCalories,
        bmiReference
      },
      userProfile: {
        height: profile.height,
        sex: profile.sex,
        birth: profile.birth,
        age
      }
    };

    // Cache the result
    cacheManager.set(cacheKey, response, config.cacheTTL.summary);

    res.json(response);
  } catch (error) {
    console.error('Error getting weight data:', error);
    res.status(500).json({ error: 'Failed to fetch weight data' });
  }
}

/**
 * GET /api/user/profile
 * Get user profile information
 */
export async function getUserProfile(req, res) {
  try {
    const cacheKey = 'user_profile';

    // Check cache
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Load user profile
    const profile = await loadUserProfile();

    // Calculate age
    const age = calculateAge(profile.birth);

    // Calculate current BMI using latest weight or current weight
    const currentWeight = profile.currentWeight || 0;
    const bmi = calculateBMI(currentWeight, profile.height);

    // Calculate BMR
    const bmr = calculateBMR(currentWeight, profile.height, age, profile.sex);

    // BMI reference table based on user's height
    const heightM = profile.height / 100;
    const bmiReference = profile.height > 0 ? {
      underweight: { bmi: 18.5, weight: parseFloat((18.5 * heightM * heightM).toFixed(1)) },
      normal: { bmi: 24, weight: parseFloat((24 * heightM * heightM).toFixed(1)) },
      overweight: { bmi: 28, weight: parseFloat((28 * heightM * heightM).toFixed(1)) },
      obese: { bmi: 30, weight: parseFloat((30 * heightM * heightM).toFixed(1)) },
      userHeight: profile.height
    } : null;

    const response = {
      height: profile.height,
      weight: currentWeight,
      sex: profile.sex,
      birth: profile.birth,
      age,
      bmi,
      initialWeight: profile.initialWeight || null,
      targetWeight: profile.targetWeight || null,
      targetBMI: profile.targetBMI || null,
      dailyCalGoal: profile.dailyCalGoal || null,
      vo2Max: profile.vo2Max || null,
      bmr,
      bmiReference
    };

    // Cache the result
    cacheManager.set(cacheKey, response, config.cacheTTL.summary);

    res.json(response);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}
