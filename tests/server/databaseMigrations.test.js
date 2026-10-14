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
  'training_session_log_items',
  'training_session_logs',
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
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
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
    const row = db.prepare('SELECT name, equipment_mode, equipment, sport_types FROM training_exercises').get();

    assert.deepEqual(
      result.applied.map((item) => item.version),
      [3, 4, 5, 6, 7, 8, 9, 10]
    );
    assert.deepEqual(
      { ...row },
      {
        name: 'Running',
        equipment_mode: 'bodyweight',
        equipment: '',
        // 迁移只补默认值，已有项目不会被写成某个具体运动类型。
        sport_types: '[]'
      }
    );
  });
});

test('moves existing training sessions from phases to their training plans', () => {
  withTemporaryDatabase((db) => {
    migrateDatabase(db);
    db.exec(`
      DROP TABLE training_session_log_items;
      DROP TABLE training_session_logs;
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
      [5, 6, 7, 8, 9, 10]
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

test('splits plan status without cascading away phases and sessions', () => {
  // 现有迁移测试用的都是裸连接（外键默认关闭），而生产在 database.js 里显式开启了外键。
  // 计划表的子表都以 ON DELETE CASCADE 指向它，所以重建计划表在生产会连带删掉全部阶段和训练单元。
  // 这个用例在外键开启的前提下跑 v10，把那条差异盖住。
  withTemporaryDatabase((db) => {
    db.exec('PRAGMA foreign_keys = ON');
    migrateDatabase(db);

    // 还原到 v10 之前：计划表仍带 status 枚举，并造出真实的子表数据。
    db.exec(`
      ALTER TABLE training_plans ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
      PRAGMA user_version = 9;

      INSERT INTO training_plans (name, start_date, end_date, status, created_at, updated_at)
      VALUES ('进行中', '2026-07-01', '2026-12-31', 'active', 1, 1),
             ('已归档', '2024-01-01', '2024-06-30', 'archived', 1, 5000),
             ('已完成', '2025-01-01', '2025-06-30', 'completed', 1, 6000);

      INSERT INTO training_phases (plan_id, name, start_date, end_date, created_at, updated_at)
      VALUES (1, '基础', '2026-07-01', '2026-09-30', 1, 1);

      INSERT INTO training_sessions (plan_id, scheduled_date, created_at, updated_at)
      VALUES (1, '2026-07-01', 1, 1), (1, '2026-07-03', 1, 1);
    `);

    const result = migrateDatabase(db);

    assert.deepEqual(
      result.applied.map((item) => item.version),
      [10]
    );
    // 子表数据必须原样保留：这正是"重建表"方案会毁掉的东西。
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM training_phases').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM training_sessions').get().count, 2);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);

    const planColumns = db
      .prepare('PRAGMA table_info(training_plans)')
      .all()
      .map((row) => row.name);
    assert.equal(planColumns.includes('status'), false);
    assert.equal(planColumns.includes('archived_at'), true);

    // 只有 archived 能对应到新模型，其余取值由日期或达成度推导，直接丢弃。
    assert.deepEqual(
      db
        .prepare('SELECT name, archived_at FROM training_plans ORDER BY id')
        .all()
        .map((row) => ({ ...row })),
      [
        { name: '进行中', archived_at: null },
        { name: '已归档', archived_at: 5000 },
        { name: '已完成', archived_at: null }
      ]
    );

    // 迁移完成后每次启动都会重跑历史版本的 validate，所以再迁移一次必须不报错。
    assert.deepEqual(migrateDatabase(db).applied, []);
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
