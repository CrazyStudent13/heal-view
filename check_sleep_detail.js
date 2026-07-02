import { databaseService } from './backend/src/services/database.js';

async function checkSleepDetail() {
  await databaseService.initialize();
  const db = databaseService.getDb();

  console.log('Checking detailed sleep data...\n');

  try {
    // Get a sample sleep record with full JSON
    const sample = db.exec("SELECT date, value FROM fitness_data WHERE key = 'sleep' LIMIT 3");
    
    if (sample.length > 0 && sample[0].values.length > 0) {
      sample[0].values.forEach((row, idx) => {
        console.log(`\n--- Record ${idx + 1} (${row[0]}) ---`);
        try {
          const parsed = JSON.parse(row[1]);
          console.log('Duration:', parsed.duration, 'minutes');
          console.log('Deep sleep:', parsed.sleep_deep_duration, 'minutes');
          console.log('Light sleep:', parsed.sleep_light_duration, 'minutes');
          console.log('REM sleep:', parsed.sleep_rem_duration, 'minutes');
          console.log('Awake duration:', parsed.sleep_awake_duration, 'minutes');
        } catch (e) {
          console.log('Error parsing:', e.message);
        }
      });
    }
  } finally {
    databaseService.close();
  }
}

checkSleepDetail();
