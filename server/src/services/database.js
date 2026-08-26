import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { config } from '../config/index.js';

/**
 * Database service backed by node:sqlite (Node built-in SQLite, no native deps).
 *
 * Node.js >= 22.13 required (node:sqlite is built into the runtime).
 * The public API (initialize / query / save / getDb / close) is kept identical
 * to the previous sql.js implementation so controllers and scripts work unchanged.
 *
 * Compatibility notes vs sql.js:
 * - query(sql, params) returns [] when no rows, else [{ columns, values }]
 *   (same shape as before, columns are strings, values are row arrays).
 * - getDb() returns a thin wrapper that emulates the sql.js surface used by
 *   this codebase: exec(sql) -> [{ columns, values }], run(sql) -> executes DML.
 *   Prefer databaseService.query() for new code.
 * - save() is a no-op: with node:sqlite every write is committed to the file
 *   immediately, there is no in-memory export step.
 */
class DatabaseService {
  constructor() {
    this.db = null;
    this.api = null;
  }

  /**
   * Initialize database connection (node:sqlite is synchronous; kept async
   * for compatibility with the previous sql.js-based API).
   */
  async initialize() {
    const existed = fs.existsSync(config.dbPath);

    // Opens the file directly; creates an empty DB file if missing.
    this.db = new DatabaseSync(config.dbPath);

    if (existed) {
      console.log('Loaded existing database');
    } else {
      console.log('Creating new database');
    }

    this.createTables();
    this.api = this.createCompatApi();
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
   * Kept for API compatibility with the previous sql.js implementation.
   * With node:sqlite all writes are persisted to disk immediately, so there
   * is nothing to export/save.
   */
  save() {
    // no-op: node:sqlite writes go straight to the file
  }

  /**
   * Execute a parameterized query (safe against SQL injection).
   * @param {string} sql - SQL with ? placeholders
   * @param {Array} params - Values to bind to placeholders
   * @returns {Array} Same format as before: [{ columns: [...], values: [[...], ...] }]
   *                  or [] when the query returns no rows.
   */
  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const cols = stmt.columns();

    // Non-SELECT statements (no result columns) — execute and return [].
    if (cols.length === 0) {
      stmt.run(...params);
      return [];
    }

    const rows = stmt.all(...params);
    if (rows.length === 0) return [];

    const columns = cols.map((c) => c.name);
    const values = rows.map((row) => columns.map((name) => row[name]));
    return [{ columns, values }];
  }

  /**
   * Return a sql.js-compatible handle (exec/run) used by controllers and
   * the import script. New code should use query() instead.
   */
  getDb() {
    return this.api;
  }

  /**
   * Build the compatibility wrapper around the raw DatabaseSync instance.
   */
  createCompatApi() {
    const db = this.db;

    return {
      /**
       * Emulate sql.js Database.exec(): returns [{ columns, values }] for
       * statements that produce rows, or [] for DDL/DML statements.
       */
      exec(sql) {
        let stmt;
        try {
          stmt = db.prepare(sql);
        } catch {
          // Multi-statement SQL or anything prepare() rejects — run natively.
          db.exec(sql);
          return [];
        }

        try {
          const cols = stmt.columns();
          if (cols.length === 0) {
            stmt.run();
            return [];
          }
          const columns = cols.map((c) => c.name);
          const rows = stmt.all();
          const values = rows.map((row) => columns.map((name) => row[name]));
          return [{ columns, values }];
        } catch {
          // Fallback: statements that cannot expose columns run natively.
          db.exec(sql);
          return [];
        }
      },

      /**
       * Emulate sql.js Database.run(): execute a statement (typically DML),
       * returns undefined.
       */
      run(sql, params = []) {
        if (params.length > 0) {
          const stmt = db.prepare(sql);
          stmt.run(...params);
        } else {
          db.exec(sql);
        }
      }
    };
  }

  /**
   * Close database connection. All data is already persisted.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.api = null;
      console.log('Database closed');
    }
  }
}

export const databaseService = new DatabaseService();
