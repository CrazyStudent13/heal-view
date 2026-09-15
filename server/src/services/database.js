import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { config } from '../config/index.js';
import { migrateDatabase } from './databaseMigrations.js';

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

    const migration = migrateDatabase(this.db);
    this.api = this.createCompatApi();
    if (migration.applied.length > 0) {
      console.log(
        'Database migrations applied:',
        migration.applied.map(({ version, name }) => `${version} (${name})`).join(', ')
      );
    }
    console.log('Database initialized:', config.dbPath);
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
    let rows;
    try {
      rows = stmt.all(...params);
    } catch {
      stmt.run(...params);
      return [];
    }

    if (rows.length === 0) return [];

    const columns = Object.keys(rows[0]);
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
          const rows = stmt.all();
          if (rows.length === 0) return [];

          const columns = Object.keys(rows[0]);
          const values = rows.map((row) => columns.map((name) => row[name]));
          return [{ columns, values }];
        } catch {
          // Fallback: statements that cannot return rows run natively.
          stmt.run();
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
