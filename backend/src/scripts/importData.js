import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import { databaseService } from '../services/database.js';
import { timestampToDate } from '../utils/timestamp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory path
const dataDir = path.join(__dirname, '../../../data');

// Valuable fitness data keys (filter out low-value high-frequency data)
const valuableFitnessKeys = new Set([
  'steps',
  'calories',
  'heart_rate',
  'stress',
  'sleep',
  'weight',
  'spo2',
  'intensity',
  'fitness_report'  // Added to support sleep data from weekly statistics
]);

/**
 * Import fitness data CSV
 */
async function importFitnessData() {
  const fileName = findFile('hlth_center_fitness_data.csv');
  if (!fileName) {
    console.log('Fitness data file not found, skipping...');
    return;
  }

  const filePath = path.join(dataDir, fileName);
  const db = databaseService.getDb();

  console.log(`Importing fitness data from: ${fileName}`);

  let count = 0;
  const batchSize = 1000;
  let insertSQL = `INSERT INTO fitness_data (uid, sid, key, time, date, value, update_time) VALUES `;
  const values = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const key = row.Key || row.key;
        // Only import valuable data types
        if (valuableFitnessKeys.has(key)) {
          const uid = row.Uid || row.uid;
          const sid = row.Sid || row.sid;
          const time = parseInt(row.Time || row.time);
          const date = timestampToDate(time);
          const value = row.Value || row.value;
          const updateTime = parseInt(row.UpdateTime || row.updateTime || 0);

          values.push(`('${uid}', '${sid}', '${key}', ${time}, '${date}', '${value.replace(/'/g, "''")}', ${updateTime})`);
          count++;

          // Batch insert
          if (values.length >= batchSize) {
            const sql = insertSQL + values.join(',');
            db.run(sql);
            values.length = 0;
            console.log(`Processed ${count} records...`);
          }
        }
      })
      .on('end', () => {
        // Insert remaining records
        if (values.length > 0) {
          const sql = insertSQL + values.join(',');
          db.run(sql);
        }
        console.log(`Imported ${count} fitness records`);
        resolve();
      })
      .on('error', (error) => {
        console.error('Error reading fitness data:', error);
        reject(error);
      });
  });
}

/**
 * Import sport records CSV
 */
async function importSportRecords() {
  const fileName = findFile('hlth_center_sport_record.csv');
  if (!fileName) {
    console.log('Sport record file not found, skipping...');
    return;
  }

  const filePath = path.join(dataDir, fileName);
  const db = databaseService.getDb();

  console.log(`Importing sport records from: ${fileName}`);

  let count = 0;
  const batchSize = 500;
  let insertSQL = `INSERT INTO sport_records (uid, sid, category, key, time, date, value, parsed_value, update_time) VALUES `;
  const values = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const uid = row.Uid || row.uid;
        const sid = row.Sid || row.sid;
        const category = row.Category || row.category;
        const key = row.Key || row.key;
        const time = parseInt(row.Time || row.time);
        const date = timestampToDate(time);
        const value = row.Value || row.value;
        const updateTime = parseInt(row.UpdateTime || row.updateTime || 0);

        values.push(`('${uid}', '${sid}', '${category}', '${key}', ${time}, '${date}', '${value.replace(/'/g, "''")}', '${value.replace(/'/g, "''")}', ${updateTime})`);
        count++;

        // Batch insert
        if (values.length >= batchSize) {
          const sql = insertSQL + values.join(',');
          db.run(sql);
          values.length = 0;
          console.log(`Processed ${count} records...`);
        }
      })
      .on('end', () => {
        // Insert remaining records
        if (values.length > 0) {
          const sql = insertSQL + values.join(',');
          db.run(sql);
        }
        console.log(`Imported ${count} sport records`);
        resolve();
      })
      .on('error', (error) => {
        console.error('Error reading sport records:', error);
        reject(error);
      });
  });
}

/**
 * Import aggregated fitness data CSV
 */
async function importAggregatedData() {
  const fileName = findFile('hlth_center_aggregated_fitness_data.csv');
  if (!fileName) {
    console.log('Aggregated data file not found, skipping...');
    return;
  }

  const filePath = path.join(dataDir, fileName);
  const db = databaseService.getDb();

  console.log(`Importing aggregated data from: ${fileName}`);

  let count = 0;
  const batchSize = 1000;
  let insertSQL = `INSERT INTO aggregated_data (uid, sid, tag, key, time, date, value, update_time) VALUES `;
  const values = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const uid = row.Uid || row.uid;
        const sid = row.Sid || row.sid;
        const tag = row.Tag || row.tag;
        const key = row.Key || row.key;
        const time = parseInt(row.Time || row.time);
        const date = timestampToDate(time);
        const value = row.Value || row.value;
        const updateTime = parseInt(row.UpdateTime || row.updateTime || 0);

        values.push(`('${uid}', '${sid}', '${tag}', '${key}', ${time}, '${date}', '${value.replace(/'/g, "''")}', ${updateTime})`);
        count++;

        // Batch insert
        if (values.length >= batchSize) {
          const sql = insertSQL + values.join(',');
          db.run(sql);
          values.length = 0;
          console.log(`Processed ${count} records...`);
        }
      })
      .on('end', () => {
        // Insert remaining records
        if (values.length > 0) {
          const sql = insertSQL + values.join(',');
          db.run(sql);
        }
        console.log(`Imported ${count} aggregated records`);
        resolve();
      })
      .on('error', (error) => {
        console.error('Error reading aggregated data:', error);
        reject(error);
      });
  });
}

/**
 * Find file in data directory
 */
function findFile(pattern) {
  const files = fs.readdirSync(dataDir);
  return files.find(f => f.includes(pattern));
}

/**
 * Main import function
 */
async function main() {
  console.log('Starting data import...\n');

  try {
    // Initialize database
    await databaseService.initialize();

    // Import all data types
    await importFitnessData();
    await importSportRecords();
    await importAggregatedData();

    // Save database
    databaseService.save();

    console.log('\nData import completed successfully!');

    // Print statistics
    const db = databaseService.getDb();
    const fitnessCount = db.exec('SELECT COUNT(*) as count FROM fitness_data')[0];
    const sportCount = db.exec('SELECT COUNT(*) as count FROM sport_records')[0];
    const aggregatedCount = db.exec('SELECT COUNT(*) as count FROM aggregated_data')[0];

    console.log('\nImport Statistics:');
    console.log(`- Fitness data: ${fitnessCount ? fitnessCount.values[0][0] : 0} records`);
    console.log(`- Sport records: ${sportCount ? sportCount.values[0][0] : 0} records`);
    console.log(`- Aggregated data: ${aggregatedCount ? aggregatedCount.values[0][0] : 0} records`);

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    databaseService.close();
  }
}

main();
