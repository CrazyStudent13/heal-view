import { databaseService } from '../services/database.js';
import { cacheManager } from '../services/cacheManager.js';
import { config } from '../config/index.js';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import { normalizeDateParam, validateDateRange } from '../utils/requestValidation.js';
import { safeJsonParse } from '../utils/jsonSafe.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '../../data');

function findDataFile(fileNameFragment) {
  if (!fs.existsSync(dataDir)) return null;

  const stack = [dataDir];
  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.name.includes(fileNameFragment)) {
        return fullPath;
      }
    }
  }

  return null;
}

// Cached user profile data (loaded once at startup)
let userProfile = null;

export function resetUserProfileCache() {
  userProfile = null;
}

/**
 * Load user profile from CSV files
 */
async function loadUserProfile() {
  // Default profile: used when no profile CSV is present (e.g. data/ cleaned),
  // so the profile/weight endpoints degrade gracefully instead of erroring.
  const resolvedProfile = {
    height: 0,
    sex: 'male',
    birth: '',
    currentWeight: 0,
    initialWeight: null,
    targetWeight: null,
    targetBMI: null,
    dailyCalGoal: null,
    vo2Max: null
  };

  function mergeProfilePatch(patch = {}) {
    if (Number.isFinite(Number(patch.heightCm)) && Number(patch.heightCm) > 0) {
      resolvedProfile.height = parseFloat(patch.heightCm);
    }
    if (patch.sex) {
      resolvedProfile.sex = patch.sex;
    }
    if (patch.birthDate) {
      resolvedProfile.birth = patch.birthDate;
    }
    if (Number.isFinite(Number(patch.initialWeightKg)) && Number(patch.initialWeightKg) > 0) {
      const weight = parseFloat(patch.initialWeightKg);
      resolvedProfile.currentWeight = weight;
      resolvedProfile.initialWeight = weight;
    }
    if (Number.isFinite(Number(patch.targetWeightKg)) && Number(patch.targetWeightKg) > 0) {
      resolvedProfile.targetWeight = parseFloat(patch.targetWeightKg);
    }
    if (Number.isFinite(Number(patch.targetBMI)) && Number(patch.targetBMI) > 0) {
      resolvedProfile.targetBMI = parseFloat(patch.targetBMI);
    }
    if (Number.isFinite(Number(patch.dailyCalorieGoal)) && Number(patch.dailyCalorieGoal) > 0) {
      resolvedProfile.dailyCalGoal = parseInt(patch.dailyCalorieGoal);
    }
    if (Number.isFinite(Number(patch.vo2Max)) && Number(patch.vo2Max) > 0) {
      resolvedProfile.vo2Max = parseInt(patch.vo2Max);
    }
  }

  try {
    // Read user_member_profile.csv for height, sex, birth
    const memberFile = findDataFile('user_member_profile');
    if (memberFile) {
      const memberRows = await new Promise((resolve) => {
        const results = [];
        fs.createReadStream(memberFile)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results));
      });
      if (memberRows.length > 0) {
        const row = memberRows[0];
        mergeProfilePatch({
          heightCm: row.Height,
          sex: row.Sex,
          birthDate: row.Birth,
          initialWeightKg: row.Weight
        });
      }
    }

    // Read user_fitness_profile.csv for target weight / calorie goal
    const profileFile = findDataFile('user_fitness_profile');
    if (profileFile) {
      const profileRows = await new Promise((resolve) => {
        const results = [];
        fs.createReadStream(profileFile)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results));
      });
      if (profileRows.length > 0) {
        const row = profileRows[0];
        mergeProfilePatch({
          dailyCalorieGoal: row.DailyCalGoal,
          vo2Max: row.Vo2Max
        });

        // Parse initial weight
        try {
          const initialWeight = safeJsonParse(row.InitialWeight, {});
          if (Number.isFinite(Number(initialWeight.weight)) && Number(initialWeight.weight) > 0) {
            const weight = parseFloat(initialWeight.weight);
            resolvedProfile.initialWeight = weight;
            if (!Number.isFinite(resolvedProfile.currentWeight) || resolvedProfile.currentWeight <= 0) {
              resolvedProfile.currentWeight = weight;
            }
          }
        } catch (e) {
          resolvedProfile.initialWeight = null;
        }

        // Parse RegularGoalList for target BMI (field:4) or target weight
        try {
          const goals = safeJsonParse(row.RegularGoalList, []);
          const weightGoal = goals.find(g => g.field === 4); // field:4 seems to be BMI/weight goal
          if (weightGoal && Number.isFinite(Number(weightGoal.target))) {
            resolvedProfile.targetBMI = parseFloat(weightGoal.target);
          }
          if (weightGoal && weightGoal.target && resolvedProfile.height > 0) {
            // Target is likely BMI, calculate target weight
            const heightM = resolvedProfile.height / 100;
            const targetBMI = weightGoal.target;
            resolvedProfile.targetWeight = parseFloat((targetBMI * heightM * heightM).toFixed(1));
          }
        } catch (e) {
          // Ignore parse error for goals
        }
      }
    }

    try {
      const importedProfile = databaseService.query(`
        SELECT value FROM fitness_data
        WHERE key = 'user_profile'
        ORDER BY update_time DESC, id DESC
        LIMIT 1
      `);

      if (importedProfile.length > 0) {
        const profile = safeJsonParse(importedProfile[0].values[0][0], {});
        mergeProfilePatch(profile);
      }
    } catch (error) {
      console.warn('Imported user profile unavailable:', error.message);
    }

    userProfile = resolvedProfile;
    console.log('User profile loaded:', JSON.stringify(userProfile, null, 2));
  } catch (error) {
    console.error('Error loading user profile:', error);
    userProfile = {
      height: 0,
      sex: 'male',
      birth: '',
      currentWeight: 0,
      initialWeight: null,
      targetWeight: null,
      targetBMI: null,
      dailyCalGoal: null,
      vo2Max: null
    };
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
    const startDate = normalizeDateParam(req.query.startDate);
    const endDate = normalizeDateParam(req.query.endDate);
    const range = validateDateRange(startDate, endDate);
    if (!range) {
      return res.status(400).json({ error: 'Invalid date range' });
    }
    const cacheKey = `weight_data_${range.startDate || 'all'}_${range.endDate || 'all'}`;

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
    if (range.startDate) {
      query += ` AND date >= ?`;
      params.push(range.startDate);
    }
    if (range.endDate) {
      query += ` AND date <= ?`;
      params.push(range.endDate);
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
    if (range.startDate) { sportQuery += ` AND date >= ?`; sportParams.push(range.startDate); }
    if (range.endDate) { sportQuery += ` AND date <= ?`; sportParams.push(range.endDate); }
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
