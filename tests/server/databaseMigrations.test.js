import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  getDatabaseVersion,
  LATEST_DATABASE_VERSION,
  migrateDatabase
} from '../../server/src/services/databaseMigrations.js';

const expectedTables = [
  'access_settings',
  'aggregated_data',
  'blood_pressure_records',
  'china_calendar_days',
  'china_calendar_years',
  'fitness_data',
  'sport_records',
  'training_exercises',
  'training_phase_reviews',
  'training_phases',
  'training_plans',
  'training_session_items',
  'training_sessions'
];

function withTemporaryDatabase(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-db-'));
  const db = new DatabaseSync(path.join(directory, 'health_data.db'));
  try {
    run(db);
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('initializes an empty database at the latest schema version', () => {
  withTemporaryDatabase((db) => {
    const result = migrateDatabase(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row) => row.name);

    assert.equal(result.initialVersion, 0);
    assert.equal(result.currentVersion, LATEST_DATABASE_VERSION);
    assert.deepEqual(
      result.applied.map((item) => item.version),
      [1, 2, 3, 4, 5, 6, 7]
    );
    assert.deepEqual(tables, expectedTables);
  });
});

test('upgrades an unversioned existing database without changing its data', () => {
  withTemporaryDatabase((db) => {
    db.exec(`
      CREATE TABLE fitness_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT,
        sid TEXT,
        key TEXT,
        time INTEGER,
        date TEXT,
        value TEXT,
        update_time INTEGER
      );
      CREATE INDEX custom_fitness_index ON fitness_data(uid);
      INSERT INTO fitness_data (uid, sid, key, time, date, value, update_time)
      VALUES ('existing-user', 'existing-source', 'steps', 1, '2026-01-01', '1000', 1);
    `);

    migrateDatabase(db);

    assert.equal(getDatabaseVersion(db), LATEST_DATABASE_VERSION);
    assert.deepEqual(
      { ...db.prepare('SELECT uid, value FROM fitness_data').get() },
      {
        uid: 'existing-user',
        value: '1000'
      }
    );
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'access_settings'").get());
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'custom_fitness_index'").get());
  });
});

test('does not reapply migrations after the schema is current', () => {
  withTemporaryDatabase((db) => {
    migrateDatabase(db);
    db.exec(`
      INSERT INTO fitness_data (uid, sid, key, time, date, value, update_time)
      VALUES ('user', 'source', 'steps', 1, '2026-01-01', '1000', 1);
    `);

    const result = migrateDatabase(db);

    assert.deepEqual(result.applied, []);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM fitness_data').get().count, 1);
  });
});

test('adds equipment fields to existing version 2 exercise data', () => {
  withTemporaryDatabase((db) => {
    db.exec(`
      CREATE TABLE fitness_data (id INTEGER, uid TEXT, sid TEXT, key TEXT, time INTEGER, date TEXT, value TEXT, update_time INTEGER);
      CREATE TABLE sport_records (id INTEGER, uid TEXT, sid TEXT, category TEXT, key TEXT, time INTEGER, date TEXT, value TEXT, parsed_value TEXT, update_time INTEGER);
      CREATE TABLE aggregated_data (id INTEGER, uid TEXT, sid TEXT, tag TEXT, key TEXT, time INTEGER, date TEXT, value TEXT, update_time INTEGER);
      CREATE TABLE blood_pressure_records (id INTEGER, uid TEXT, sid TEXT, external_id TEXT, time INTEGER, date TEXT, value TEXT, parsed_value TEXT, update_time INTEGER);
      CREATE TABLE access_settings (id INTEGER, enabled INTEGER, password_hash TEXT, updated_at INTEGER);
      CREATE TABLE training_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'mdi:fitness-center',
        category TEXT NOT NULL DEFAULT 'other',
        scene TEXT NOT NULL DEFAULT 'indoor',
        verification_mode TEXT NOT NULL DEFAULT 'manual',
        metrics TEXT NOT NULL DEFAULT '[]',
        purpose TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
      VALUES ('Running', 'mdi:run', 'aerobic', 'outdoor', 'auto', '["duration"]', 'Cardio', 1, 1, 1);
      PRAGMA user_version = 2;
    `);

    const result = migrateDatabase(db);
    const row = db.prepare('SELECT name, equipment_mode, equipment FROM training_exercises').get();

    assert.deepEqual(
      result.applied.map((item) => item.version),
      [3, 4, 5, 6, 7]
    );
    assert.deepEqual(
      { ...row },
      {
        name: 'Running',
        equipment_mode: 'bodyweight',
        equipment: ''
      }
    );
  });
});

test('moves existing training sessions from phases to their training plans', () => {
  withTemporaryDatabase((db) => {
    migrateDatabase(db);
    db.exec(`
      DROP TABLE training_session_items;
      DROP TABLE training_sessions;
      CREATE TABLE training_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phase_id INTEGER NOT NULL REFERENCES training_phases(id) ON DELETE CASCADE,
        scheduled_date TEXT NOT NULL,
        sequence INTEGER NOT NULL DEFAULT 1 CHECK (sequence > 0),
        name TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'planned',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (phase_id, scheduled_date, sequence)
      );
      CREATE TABLE training_session_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES training_exercises(id) ON DELETE RESTRICT,
        position INTEGER NOT NULL DEFAULT 0,
        verification_mode TEXT NOT NULL,
        targets TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (session_id, exercise_id)
      );
      INSERT INTO training_plans (name, start_date, end_date, created_at, updated_at)
      VALUES ('Recovery', '2026-09-01', '2026-09-30', 1, 1);
      INSERT INTO training_phases (plan_id, name, start_date, end_date, created_at, updated_at)
      VALUES (1, 'Foundation', '2026-09-01', '2026-09-30', 1, 1);
      INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, metrics, purpose, enabled, created_at, updated_at)
      VALUES ('Walking', 'mdi:walk', 'aerobic', 'outdoor', 'auto', '["duration"]', '', 1, 1, 1);
      INSERT INTO training_sessions (phase_id, scheduled_date, name, created_at, updated_at)
      VALUES (1, '2026-09-17', 'Easy walk', 1, 1);
      INSERT INTO training_session_items
        (session_id, exercise_id, verification_mode, targets, created_at, updated_at)
      VALUES (1, 1, 'auto', '{"duration":30}', 1, 1);
      PRAGMA user_version = 4;
    `);

    const result = migrateDatabase(db);

    assert.deepEqual(
      result.applied.map((item) => item.version),
      [5, 6, 7]
    );
    assert.deepEqual(
      { ...db.prepare('SELECT plan_id, scheduled_date, name FROM training_sessions').get() },
      { plan_id: 1, scheduled_date: '2026-09-17', name: 'Easy walk' }
    );
    assert.deepEqual(
      { ...db.prepare('SELECT session_id, targets FROM training_session_items').get() },
      { session_id: 1, targets: '{"duration":30}' }
    );
  });
});

test('rejects databases created by a newer application version', () => {
  withTemporaryDatabase((db) => {
    db.exec(`PRAGMA user_version = ${LATEST_DATABASE_VERSION + 1}`);

    assert.throws(() => migrateDatabase(db), /is newer than supported version/);
  });
});

test('does not mark an incompatible existing schema as migrated', () => {
  withTemporaryDatabase((db) => {
    db.exec('CREATE TABLE fitness_data (id INTEGER PRIMARY KEY)');

    assert.throws(() => migrateDatabase(db), /Database migration 1 \(initial schema\) failed/);
    assert.equal(getDatabaseVersion(db), 0);
    assert.deepEqual(
      db
        .prepare('PRAGMA table_info(fitness_data)')
        .all()
        .map((row) => row.name),
      ['id']
    );
    assert.equal(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'access_settings'").get(),
      undefined
    );
  });
});
