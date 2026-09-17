// 数据库迁移一经发布只能追加，不能修改旧版本，确保所有部署实例沿相同路径升级。
const migrations = [
  {
    version: 1,
    name: 'initial schema',
    // 执行版本 1 的结构升级。
    up(db) {
      // 版本 1 是当前稳定结构的基线，同时兼容空库和已有但尚未记录版本的旧数据库。
      db.exec(`
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

        CREATE TABLE IF NOT EXISTS blood_pressure_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uid TEXT,
          sid TEXT,
          external_id TEXT,
          time INTEGER,
          date TEXT,
          value TEXT,
          parsed_value TEXT,
          update_time INTEGER
        );

        CREATE TABLE IF NOT EXISTS access_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          enabled INTEGER NOT NULL DEFAULT 0,
          password_hash TEXT,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_fitness_date ON fitness_data(date);
        CREATE INDEX IF NOT EXISTS idx_fitness_key ON fitness_data(key);
        CREATE INDEX IF NOT EXISTS idx_sport_date ON sport_records(date);
        CREATE INDEX IF NOT EXISTS idx_sport_category ON sport_records(category);
        CREATE INDEX IF NOT EXISTS idx_aggregated_date ON aggregated_data(date);
        CREATE INDEX IF NOT EXISTS idx_aggregated_key ON aggregated_data(key);
        CREATE INDEX IF NOT EXISTS idx_blood_pressure_date ON blood_pressure_records(date);
        CREATE INDEX IF NOT EXISTS idx_blood_pressure_time ON blood_pressure_records(time);
      `);
    },
    // 校验版本 1 所需的表和字段。
    validate(db) {
      validateRequiredColumns(db, versionOneRequiredColumns);
    }
  },
  {
    version: 2,
    name: 'training exercise catalog',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS training_exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          icon TEXT NOT NULL DEFAULT 'mdi:fitness-center',
          category TEXT NOT NULL DEFAULT 'other',
          scene TEXT NOT NULL DEFAULT 'indoor',
          verification_mode TEXT NOT NULL DEFAULT 'manual',
          metrics TEXT NOT NULL DEFAULT '[]',
          purpose TEXT NOT NULL DEFAULT '',
          enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_training_exercises_enabled ON training_exercises(enabled);
        CREATE INDEX IF NOT EXISTS idx_training_exercises_category ON training_exercises(category);
      `);
    },
    validate(db) {
      validateRequiredColumns(db, versionTwoRequiredColumns);
    }
  },
  {
    version: 3,
    name: 'training exercise equipment',
    up(db) {
      db.exec(`
        ALTER TABLE training_exercises
          ADD COLUMN equipment_mode TEXT NOT NULL DEFAULT 'bodyweight'
          CHECK (equipment_mode IN ('bodyweight', 'equipment'));
        ALTER TABLE training_exercises
          ADD COLUMN equipment TEXT NOT NULL DEFAULT '';
      `);
    },
    validate(db) {
      validateRequiredColumns(db, versionThreeRequiredColumns);
    }
  },
  {
    version: 4,
    name: 'training plans phases and sessions',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS training_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          goal TEXT NOT NULL DEFAULT '',
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
          notes TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS training_phases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          adjustment_reason TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'planned'
            CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
          position INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS training_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phase_id INTEGER NOT NULL REFERENCES training_phases(id) ON DELETE CASCADE,
          scheduled_date TEXT NOT NULL,
          sequence INTEGER NOT NULL DEFAULT 1 CHECK (sequence > 0),
          name TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'planned'
            CHECK (status IN ('planned', 'achieved', 'partial', 'no_data', 'unverifiable', 'skipped')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE (phase_id, scheduled_date, sequence)
        );

        CREATE TABLE IF NOT EXISTS training_session_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES training_exercises(id) ON DELETE RESTRICT,
          position INTEGER NOT NULL DEFAULT 0,
          verification_mode TEXT NOT NULL
            CHECK (verification_mode IN ('auto', 'manual', 'mixed')),
          targets TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE (session_id, exercise_id)
        );

        CREATE INDEX IF NOT EXISTS idx_training_plans_status ON training_plans(status);
        CREATE INDEX IF NOT EXISTS idx_training_plans_dates ON training_plans(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_training_phases_plan ON training_phases(plan_id, position);
        CREATE INDEX IF NOT EXISTS idx_training_phases_dates ON training_phases(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_training_sessions_phase ON training_sessions(phase_id, scheduled_date, sequence);
        CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(scheduled_date);
        CREATE INDEX IF NOT EXISTS idx_training_session_items_session ON training_session_items(session_id, position);
        CREATE INDEX IF NOT EXISTS idx_training_session_items_exercise ON training_session_items(exercise_id);
      `);
    },
    validate(db) {
      validateVersionFourSchema(db);
    }
  },
  {
    version: 5,
    name: 'link training sessions directly to plans',
    up(db) {
      db.exec(`
        CREATE TABLE training_sessions_v5 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
          scheduled_date TEXT NOT NULL,
          sequence INTEGER NOT NULL DEFAULT 1 CHECK (sequence > 0),
          name TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'planned'
            CHECK (status IN ('planned', 'achieved', 'partial', 'no_data', 'unverifiable', 'skipped')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE (plan_id, scheduled_date, sequence)
        );

        INSERT INTO training_sessions_v5
          (id, plan_id, scheduled_date, sequence, name, notes, status, created_at, updated_at)
        SELECT s.id, p.plan_id, s.scheduled_date, s.sequence, s.name, s.notes, s.status, s.created_at, s.updated_at
        FROM training_sessions s
        JOIN training_phases p ON p.id = s.phase_id;

        CREATE TABLE training_session_items_v5 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES training_sessions_v5(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES training_exercises(id) ON DELETE RESTRICT,
          position INTEGER NOT NULL DEFAULT 0,
          verification_mode TEXT NOT NULL
            CHECK (verification_mode IN ('auto', 'manual', 'mixed')),
          targets TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE (session_id, exercise_id)
        );

        INSERT INTO training_session_items_v5
          (id, session_id, exercise_id, position, verification_mode, targets, created_at, updated_at)
        SELECT id, session_id, exercise_id, position, verification_mode, targets, created_at, updated_at
        FROM training_session_items;

        DROP TABLE training_session_items;
        DROP TABLE training_sessions;
        ALTER TABLE training_sessions_v5 RENAME TO training_sessions;
        ALTER TABLE training_session_items_v5 RENAME TO training_session_items;

        CREATE INDEX idx_training_sessions_plan ON training_sessions(plan_id, scheduled_date, sequence);
        CREATE INDEX idx_training_sessions_date ON training_sessions(scheduled_date);
        CREATE INDEX idx_training_session_items_session ON training_session_items(session_id, position);
        CREATE INDEX idx_training_session_items_exercise ON training_session_items(exercise_id);
      `);
    },
    validate(db) {
      validateRequiredColumns(db, versionFiveRequiredColumns);
    }
  }
];

export const LATEST_DATABASE_VERSION = migrations.at(-1)?.version ?? 0;

// 每个版本明确记录必需字段，防止残缺旧库被错误标记为已完成迁移。
const versionOneRequiredColumns = {
  fitness_data: ['id', 'uid', 'sid', 'key', 'time', 'date', 'value', 'update_time'],
  sport_records: ['id', 'uid', 'sid', 'category', 'key', 'time', 'date', 'value', 'parsed_value', 'update_time'],
  aggregated_data: ['id', 'uid', 'sid', 'tag', 'key', 'time', 'date', 'value', 'update_time'],
  blood_pressure_records: ['id', 'uid', 'sid', 'external_id', 'time', 'date', 'value', 'parsed_value', 'update_time'],
  access_settings: ['id', 'enabled', 'password_hash', 'updated_at']
};

const versionTwoRequiredColumns = {
  training_exercises: [
    'id',
    'name',
    'icon',
    'category',
    'scene',
    'verification_mode',
    'metrics',
    'purpose',
    'enabled',
    'created_at',
    'updated_at'
  ]
};

const versionThreeRequiredColumns = {
  training_exercises: ['equipment_mode', 'equipment']
};

const versionFourRequiredColumns = {
  training_plans: ['id', 'name', 'goal', 'start_date', 'end_date', 'status', 'notes', 'created_at', 'updated_at'],
  training_phases: [
    'id',
    'plan_id',
    'name',
    'start_date',
    'end_date',
    'description',
    'adjustment_reason',
    'status',
    'position',
    'created_at',
    'updated_at'
  ],
  training_sessions: [
    'id',
    'phase_id',
    'scheduled_date',
    'sequence',
    'name',
    'notes',
    'status',
    'created_at',
    'updated_at'
  ],
  training_session_items: [
    'id',
    'session_id',
    'exercise_id',
    'position',
    'verification_mode',
    'targets',
    'created_at',
    'updated_at'
  ]
};

const versionFiveRequiredColumns = {
  training_sessions: [
    'id',
    'plan_id',
    'scheduled_date',
    'sequence',
    'name',
    'notes',
    'status',
    'created_at',
    'updated_at'
  ],
  training_session_items: [
    'id',
    'session_id',
    'exercise_id',
    'position',
    'verification_mode',
    'targets',
    'created_at',
    'updated_at'
  ]
};

function validateVersionFourSchema(db) {
  validateRequiredColumns(db, {
    ...versionFourRequiredColumns,
    training_sessions: versionFourRequiredColumns.training_sessions.filter((column) => column !== 'phase_id')
  });

  const sessionColumns = new Set(
    db
      .prepare('PRAGMA table_info(training_sessions)')
      .all()
      .map((row) => row.name)
  );
  if (!sessionColumns.has('phase_id') && !sessionColumns.has('plan_id')) {
    throw new Error('Table training_sessions is missing its plan association');
  }
}

/**
 * 校验数据库表是否包含当前版本要求的全部字段。
 * @param {import('node:sqlite').DatabaseSync} db SQLite 数据库连接
 * @param {Record<string, string[]>} requiredColumns 表名与必需字段的对应关系
 */
function validateRequiredColumns(db, requiredColumns) {
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const actualColumns = new Set(
      db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((row) => row.name)
    );
    const missingColumns = columns.filter((column) => !actualColumns.has(column));
    if (missingColumns.length > 0) {
      throw new Error(`Table ${table} is missing columns: ${missingColumns.join(', ')}`);
    }
  }
}

/**
 * 获取当前数据库的结构版本号。
 * @param {import('node:sqlite').DatabaseSync} db SQLite 数据库连接
 * @returns {number} 当前结构版本号
 */
export function getDatabaseVersion(db) {
  // SQLite 的 user_version 是应用可自行维护的整数，适合记录结构版本。
  return Number(db.prepare('PRAGMA user_version').get().user_version);
}

/**
 * 按版本顺序执行尚未应用的数据库结构迁移。
 * @param {import('node:sqlite').DatabaseSync} db SQLite 数据库连接
 * @returns {{ initialVersion: number, currentVersion: number, applied: Array<{ version: number, name: string }> }} 迁移结果
 */
export function migrateDatabase(db) {
  const initialVersion = getDatabaseVersion(db);

  if (initialVersion > LATEST_DATABASE_VERSION) {
    throw new Error(`Database version ${initialVersion} is newer than supported version ${LATEST_DATABASE_VERSION}`);
  }

  const applied = [];
  for (const migration of migrations) {
    if (migration.version <= initialVersion) continue;

    // 每次迁移独立使用事务；建表、校验或写版本号任一步失败都会整体回滚。
    db.exec('BEGIN IMMEDIATE');
    try {
      migration.up(db);
      migration.validate?.(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
      applied.push({ version: migration.version, name: migration.name });
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Database migration ${migration.version} (${migration.name}) failed: ${error.message}`, {
        cause: error
      });
    }
  }

  // 即使没有新迁移，也检查当前版本对应的结构，尽早发现数据库损坏或手工误改。
  for (const migration of migrations) {
    if (migration.version <= getDatabaseVersion(db)) migration.validate?.(db);
  }

  return {
    initialVersion,
    currentVersion: getDatabaseVersion(db),
    applied
  };
}
