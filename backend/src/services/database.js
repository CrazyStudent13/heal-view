import initSqlJs from 'sql.js';
import fs from 'fs';
import { config } from '../config/index.js';

class DatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    this.SQL = await initSqlJs();

    // Load existing database or create new one
    let dbBuffer;
    try {
      dbBuffer = fs.readFileSync(config.dbPath);
      console.log('Loaded existing database');
    } catch (e) {
      console.log('Creating new database');
      dbBuffer = null;
    }

    this.db = new this.SQL.Database(dbBuffer);
    this.createTables();
    console.log('Database initialized:', config.dbPath);
  }

  /**
   * Create tables if not exist
   */
  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fitness_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT,
        sid TEXT,
        key TEXT,
        time INTEGER,
        date TEXT,
        value TEXT,
        update_time INTEGER
      );

      CREATE TABLE IF NOT EXISTS sport_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT,
        sid TEXT,
        category TEXT,
        key TEXT,
        time INTEGER,
        date TEXT,
        value TEXT,
        parsed_value TEXT,
        update_time INTEGER
      );

      CREATE TABLE IF NOT EXISTS aggregated_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT,
        sid TEXT,
        tag TEXT,
        key TEXT,
        time INTEGER,
        date TEXT,
        value TEXT,
        update_time INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_fitness_date ON fitness_data(date);
      CREATE INDEX IF NOT EXISTS idx_fitness_key ON fitness_data(key);
      CREATE INDEX IF NOT EXISTS idx_sport_date ON sport_records(date);
      CREATE INDEX IF NOT EXISTS idx_sport_category ON sport_records(category);
      CREATE INDEX IF NOT EXISTS idx_aggregated_date ON aggregated_data(date);
      CREATE INDEX IF NOT EXISTS idx_aggregated_key ON aggregated_data(key);
    `);
    console.log('Database tables created');
  }

  /**
   * Save database to file
   */
  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  }

  /**
   * Get database instance
   */
  getDb() {
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.save();
      this.db.close();
      console.log('Database saved and closed');
    }
  }
}

export const databaseService = new DatabaseService();
