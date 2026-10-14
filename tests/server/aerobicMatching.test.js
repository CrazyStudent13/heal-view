import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../server/src/config/index.js';
import {
  collectRecordSportTypeKeys,
  normalizeSportTypes,
  recordMatchesSportTypes,
  resolveSportTypeKey
} from '../../server/src/utils/sportTypes.js';
import {
  evaluateAerobicItem,
  extractVerifiableTargets,
  normalizeSportRecordRow,
  summarizeCoverage,
  summarizeItemResults
} from '../../server/src/services/aerobicMatching.js';
import {
  createTrainingPlan,
  createTrainingSession,
  getTrainingPlan,
  listTrainingPlans
} from '../../server/src/controllers/trainingPlanController.js';
import { getTrainingExecution } from '../../server/src/controllers/trainingExecutionController.js';
import { databaseService } from '../../server/src/services/database.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send() {
      return this;
    }
  };
}

function lastInsertId() {
  return Number(databaseService.query('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}

/** 造一条 sport_records 表形状的记录，并按读取路径归一，保证测试和线上走同一条链路。 */
function sportRecord({ date, duration = null, distance = null, calories = null, sportType = 2, category = 'walking' }) {
  return normalizeSportRecordRow({
    id: 1,
    date,
    category,
    key: category,
    time: 1,
    value: JSON.stringify({ sport_type: sportType, category, start_time: 1, duration, distance, calories })
  });
}

function insertSportRecord(db, { date, duration, distance, category = 'walking', sportType = 2 }) {
  const value = JSON.stringify({ sport_type: sportType, category, start_time: 1, duration, distance });
  db.run(
    `INSERT INTO sport_records (uid, sid, category, "key", time, date, value, parsed_value, update_time)
     VALUES ('test', 'test', ?, ?, 1, ?, ?, ?, ?)`,
    [category, category, date, value, value, Date.now()]
  );
}

function insertAerobicExercise(db, { name, sportTypes, metrics = '["duration","distance"]', mode = 'auto' }) {
  db.run(
    `INSERT INTO training_exercises
      (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, sport_types, enabled, created_at, updated_at)
     VALUES (?, 'mdi:walk', 'aerobic', 'indoor', ?, 'equipment', 'Treadmill', ?, 'Cardio', ?, 1, ?, ?)`,
    [name, mode, metrics, JSON.stringify(sportTypes), Date.now(), Date.now()]
  );
  return lastInsertId();
}

test('resolves imported sport type spellings to stable slugs', () => {
  assert.equal(resolveSportTypeKey(2), 'walking');
  assert.equal(resolveSportTypeKey('22'), 'walking');
  assert.equal(resolveSportTypeKey('outdoor_walking'), 'walking');
  assert.equal(resolveSportTypeKey('treadmill_running'), 'running');
  assert.equal(resolveSportTypeKey(11), 'elliptical');
  assert.equal(resolveSportTypeKey('rowing_machine'), 'rowing');
  assert.equal(resolveSportTypeKey('huawei_rowing_machine'), 'rowing');
  assert.equal(resolveSportTypeKey('dragon_boat'), null);
  assert.equal(resolveSportTypeKey(''), null);
  assert.equal(resolveSportTypeKey(null), null);
});

test('collects every slug a single imported record can match', () => {
  assert.deepEqual(collectRecordSportTypeKeys({ sport_type: 2, category: 'outdoor_walking' }), ['walking']);
  assert.deepEqual(collectRecordSportTypeKeys({ sport_type: 1, category: 'walking' }), ['running', 'walking']);
  assert.deepEqual(collectRecordSportTypeKeys({ category: 'unknown_sport' }), []);
});

test('accepts only known sport types when saving an exercise', () => {
  assert.deepEqual(normalizeSportTypes(['walking', 'running']), ['walking', 'running']);
  assert.deepEqual(normalizeSportTypes(['walking', 'walking']), ['walking']);
  assert.deepEqual(normalizeSportTypes([]), []);
  assert.deepEqual(normalizeSportTypes(undefined), []);
  assert.equal(normalizeSportTypes(['walking', 'dragon_boat']), null);
  assert.equal(normalizeSportTypes('walking'), null);
});

test('matches records against the configured sport types only', () => {
  assert.equal(recordMatchesSportTypes(['walking'], { sport_type: 2, category: 'walking' }), true);
  assert.equal(recordMatchesSportTypes(['walking'], { sport_type: 1, category: 'running' }), false);
  assert.equal(recordMatchesSportTypes([], { sport_type: 2, category: 'walking' }), false);
});

test('reads duration, distance and calories out of the imported record payload', () => {
  const record = sportRecord({ date: '2026-09-02', duration: 1830, distance: 3200, calories: 210 });
  assert.equal(record.durationSeconds, 1830);
  assert.equal(record.distanceMeters, 3200);
  assert.equal(record.calories, 210);

  // value 不是合法 JSON 时不应抛错，只当作一条没有指标的空记录。
  const broken = normalizeSportRecordRow({
    id: 2,
    date: '2026-09-02',
    category: 'walking',
    time: 0,
    value: 'not-json'
  });
  assert.equal(broken.durationSeconds, null);
  assert.equal(broken.category, 'walking');
});

test('extracts only auto-checkable targets, normalizing duration to seconds', () => {
  assert.deepEqual(extractVerifiableTargets({ duration: 30, distance: 3, sets: 3 }), [
    { metric: 'durationSeconds', target: 1800 },
    { metric: 'distance', target: 3 }
  ]);
  assert.deepEqual(extractVerifiableTargets({ durationSeconds: 1200, durationUnit: 'seconds' }), [
    { metric: 'durationSeconds', target: 1200 }
  ]);
  assert.deepEqual(extractVerifiableTargets({ sets: 3, weight: 50 }), []);
});

test('marks a matching record as achieved when every measurable target is met', () => {
  const result = evaluateAerobicItem({
    targets: { duration: 30, distance: 3 },
    sportTypes: ['walking'],
    records: [sportRecord({ date: '2026-09-02', duration: 1900, distance: 3400 })],
    scheduledDate: '2026-09-02',
    today: '2026-09-30'
  });

  assert.equal(result.status, 'achieved');
  assert.equal(result.reason, 'matched');
  assert.equal(result.verifiable, true);
  assert.equal(result.record.distanceMeters, 3400);
  assert.equal(result.matchedMetrics.length, 2);
});

test('falls back to partial when a matching record misses part of the target', () => {
  const result = evaluateAerobicItem({
    targets: { duration: 30, distance: 3 },
    sportTypes: ['walking'],
    records: [sportRecord({ date: '2026-09-02', duration: 1800, distance: 1500 })],
    scheduledDate: '2026-09-02',
    today: '2026-09-30'
  });

  assert.equal(result.status, 'partial');
  // 时长刚好达标，但距离只完成一半，仍按最弱的一项判定。
  assert.equal(result.progress, 0.5);
});

test('reports no data instead of failure when nothing was imported', () => {
  const past = evaluateAerobicItem({
    targets: { duration: 30 },
    sportTypes: ['walking'],
    records: [],
    scheduledDate: '2026-09-02',
    today: '2026-09-30'
  });
  assert.equal(past.status, 'no_data');
  assert.equal(past.reason, 'no_record');

  const upcoming = evaluateAerobicItem({
    targets: { duration: 30 },
    sportTypes: ['walking'],
    records: [],
    scheduledDate: '2026-10-05',
    today: '2026-09-30'
  });
  assert.equal(upcoming.status, 'planned');
  assert.equal(upcoming.reason, 'pending');
});

test('ignores imported records of a different sport type or date', () => {
  const result = evaluateAerobicItem({
    targets: { duration: 30 },
    sportTypes: ['walking'],
    records: [
      sportRecord({ date: '2026-09-02', duration: 3600, sportType: 1, category: 'running' }),
      sportRecord({ date: '2026-09-03', duration: 3600 })
    ],
    scheduledDate: '2026-09-02',
    today: '2026-09-30'
  });

  assert.equal(result.status, 'no_data');
});

test('marks items unverifiable when nothing can be checked automatically', () => {
  const noSportTypes = evaluateAerobicItem({
    targets: { duration: 30 },
    sportTypes: [],
    records: [sportRecord({ date: '2026-09-02', duration: 1800 })],
    scheduledDate: '2026-09-02',
    today: '2026-09-30'
  });
  assert.equal(noSportTypes.status, 'unverifiable');
  assert.equal(noSportTypes.verifiable, false);

  const noTargets = evaluateAerobicItem({
    targets: { sets: 3 },
    sportTypes: ['walking'],
    records: [sportRecord({ date: '2026-09-02', duration: 1800 })],
    scheduledDate: '2026-09-02',
    today: '2026-09-30'
  });
  assert.equal(noTargets.status, 'unverifiable');
  assert.equal(noTargets.reason, 'no_target');

  const recordWithoutMetrics = evaluateAerobicItem({
    targets: { duration: 30 },
    sportTypes: ['walking'],
    records: [sportRecord({ date: '2026-09-02' })],
    scheduledDate: '2026-09-02',
    today: '2026-09-30'
  });
  assert.equal(recordWithoutMetrics.status, 'unverifiable');
  assert.equal(recordWithoutMetrics.reason, 'record_missing_metrics');
});

test('picks the record closest to the target and flags the day as ambiguous', () => {
  const result = evaluateAerobicItem({
    targets: { duration: 30 },
    sportTypes: ['walking'],
    records: [
      sportRecord({ date: '2026-09-02', duration: 300, distance: 200 }),
      sportRecord({ date: '2026-09-02', duration: 1800, distance: 3000 })
    ],
    scheduledDate: '2026-09-02',
    today: '2026-09-30'
  });

  assert.equal(result.status, 'achieved');
  assert.equal(result.ambiguous, true);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.record.durationSeconds, 1800);
});

test('summarizes item results and keeps coverage separate from completion', () => {
  const summary = summarizeItemResults([
    { status: 'achieved' },
    { status: 'partial' },
    { status: 'no_data' },
    { status: 'unverifiable' },
    { status: 'planned' }
  ]);
  assert.deepEqual(summary, { achieved: 1, partial: 1, noData: 1, unverifiable: 1, planned: 1, total: 5 });

  const coverage = summarizeCoverage([
    { verifiable: true, status: 'achieved' },
    { verifiable: true, status: 'partial' },
    { verifiable: true, status: 'no_data' },
    { verifiable: false, status: 'unverifiable' }
  ]);
  assert.equal(coverage.verifiableItems, 3);
  assert.equal(coverage.matchedItems, 2);
  assert.equal(coverage.coverageRate, 0.667);
  assert.equal(coverage.verifiableCompletionRate, 0.5);

  // 没有可验证项目时返回 null，避免前端显示 0% 造成误导。
  assert.equal(summarizeCoverage([]).coverageRate, null);
  assert.equal(summarizeCoverage([]).verifiableCompletionRate, null);
});

test('matches imported sport records into plan sessions and recalculates after reimport', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-aerobic-match-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const db = databaseService.getDb();
    const exerciseId = insertAerobicExercise(db, { name: 'Brisk walking', sportTypes: ['walking'] });

    const planResponse = responseRecorder();
    createTrainingPlan(
      { body: { name: 'Aerobic plan', startDate: '2020-01-01', endDate: '2020-01-31' } },
      planResponse
    );
    const planId = planResponse.body.id;

    for (const scheduledDate of ['2020-01-02', '2020-01-03', '2020-01-04']) {
      const response = responseRecorder();
      createTrainingSession(
        {
          params: { planId },
          body: { scheduledDate, items: [{ exerciseId, targets: { duration: 30, distance: 3 } }] }
        },
        response
      );
      assert.equal(response.statusCode, 201);
    }

    // 01-02 全部达标；01-03 只完成一半；01-04 没有导入数据。
    insertSportRecord(db, { date: '2020-01-02', duration: 1900, distance: 3400 });
    insertSportRecord(db, { date: '2020-01-03', duration: 1500, distance: 1500 });

    const detail = responseRecorder();
    getTrainingPlan({ params: { id: planId } }, detail);
    assert.equal(detail.statusCode, 200);

    assert.deepEqual(
      Object.fromEntries(detail.body.sessions.map((session) => [session.scheduledDate, session.status])),
      { '2020-01-02': 'achieved', '2020-01-03': 'partial', '2020-01-04': 'no_data' }
    );
    assert.deepEqual(detail.body.coverage, {
      verifiableItems: 3,
      matchedItems: 2,
      coverageRate: 0.667,
      achievedItems: 1,
      partialItems: 1,
      verifiableCompletionRate: 0.5
    });

    const [firstSession] = detail.body.sessions;
    assert.equal(firstSession.items[0].match.status, 'achieved');
    assert.equal(firstSession.items[0].match.record.distanceMeters, 3400);
    assert.deepEqual(firstSession.autoSummary, {
      achieved: 1,
      partial: 0,
      noData: 0,
      unverifiable: 0,
      planned: 0,
      total: 1
    });

    const list = responseRecorder();
    listTrainingPlans({}, list);
    const listedPlan = list.body.plans.find((plan) => plan.id === planId);
    // 达标和部分达标都算履约，01-04 没有导入数据按打卡口径算缺席，所以是 2/3。
    assert.equal(listedPlan.lifecycle, 'ended');
    assert.equal(listedPlan.adherence.eligibleDays, 3);
    assert.equal(listedPlan.adherence.fulfilledDays, 2);
    assert.equal(listedPlan.adherence.extraDays, 0);
    assert.equal(listedPlan.adherence.rate, 2 / 3);
    assert.equal(listedPlan.adherence.tier, 'slight_shortfall');
    assert.equal(listedPlan.coverage.matchedItems, 2);

    // 清空导入数据后重新读取：结果重算为"没有数据"，不残留失效的运动记录引用。
    db.run('DELETE FROM sport_records');
    const cleared = responseRecorder();
    getTrainingPlan({ params: { id: planId } }, cleared);
    assert.deepEqual(
      cleared.body.sessions.map((session) => session.status),
      ['no_data', 'no_data', 'no_data']
    );
    assert.equal(cleared.body.coverage.matchedItems, 0);
    assert.equal(cleared.body.coverage.coverageRate, 0);

    const clearedList = responseRecorder();
    listTrainingPlans({}, clearedList);
    const clearedPlan = clearedList.body.plans.find((plan) => plan.id === planId);
    // 无数据等于缺席：分母还在，分子清零，档位掉到最低而不是"暂无"。
    assert.equal(clearedPlan.adherence.eligibleDays, 3);
    assert.equal(clearedPlan.adherence.fulfilledDays, 0);
    assert.equal(clearedPlan.adherence.rate, 0);
    assert.equal(clearedPlan.adherence.tier, 'absent');
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps manual execution results ahead of automatic matching', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-aerobic-manual-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const db = databaseService.getDb();
    const exerciseId = insertAerobicExercise(db, { name: 'Treadmill walk', sportTypes: ['walking'] });

    const planResponse = responseRecorder();
    createTrainingPlan(
      { body: { name: 'Manual wins', startDate: '2020-02-01', endDate: '2020-02-28', status: 'active' } },
      planResponse
    );
    const sessionResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: { scheduledDate: '2020-02-02', status: 'skipped', items: [{ exerciseId, targets: { duration: 30 } }] }
      },
      sessionResponse
    );
    assert.equal(sessionResponse.statusCode, 201);

    // 即使导入了达标记录，手工标记的"已跳过"也不能被自动匹配覆盖。
    insertSportRecord(db, { date: '2020-02-02', duration: 3600 });

    const detail = responseRecorder();
    getTrainingPlan({ params: { id: planResponse.body.id } }, detail);
    const [session] = detail.body.sessions;
    assert.equal(session.plannedStatus, 'skipped');
    assert.equal(session.status, 'skipped');
    // 匹配结果本身仍然照常展示，方便对照实际记录。
    assert.equal(session.items[0].match.status, 'achieved');
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps a mixed session pending until the manual items are confirmed', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-aerobic-mixed-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const db = databaseService.getDb();
    const aerobicId = insertAerobicExercise(db, { name: 'Treadmill walk', sportTypes: ['walking'] });
    db.run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, sport_types, enabled, created_at, updated_at)
       VALUES ('Lat pulldown', 'mdi:dumbbell', 'strength', 'indoor', 'manual', 'equipment', 'Machine', '["weight","sets"]', 'Back', '[]', 1, ?, ?)`,
      [Date.now(), Date.now()]
    );
    const strengthId = lastInsertId();

    const planResponse = responseRecorder();
    createTrainingPlan(
      { body: { name: 'Mixed day', startDate: '2020-03-01', endDate: '2020-03-31', status: 'active' } },
      planResponse
    );
    const sessionResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: {
          scheduledDate: '2020-03-02',
          items: [
            { exerciseId: aerobicId, targets: { duration: 30 } },
            { exerciseId: strengthId, targets: { weight: 40, sets: 3 } }
          ]
        }
      },
      sessionResponse
    );
    assert.equal(sessionResponse.statusCode, 201);
    insertSportRecord(db, { date: '2020-03-02', duration: 3600 });

    const detail = responseRecorder();
    getTrainingPlan({ params: { id: planResponse.body.id } }, detail);
    const [session] = detail.body.sessions;
    // 有氧部分已经达标，但器械项目还没确认，不能把整天算成完成。
    assert.equal(session.status, 'planned');
    assert.equal(session.autoSummary.achieved, 1);
    assert.equal(session.items[0].match.status, 'achieved');
    assert.equal(session.items[1].match, null);
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('exposes automatic verification results to the mobile training page', async () => {
  const originalDbPath = config.dbPath;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heal-view-aerobic-mobile-'));
  config.dbPath = path.join(directory, 'health_data.db');

  try {
    await databaseService.initialize();
    const db = databaseService.getDb();
    const aerobicId = insertAerobicExercise(db, { name: 'Treadmill walk', sportTypes: ['walking'] });
    db.run(
      `INSERT INTO training_exercises
        (name, icon, category, scene, verification_mode, equipment_mode, equipment, metrics, purpose, sport_types, enabled, created_at, updated_at)
       VALUES ('Lat pulldown', 'mdi:dumbbell', 'strength', 'indoor', 'manual', 'equipment', 'Machine', '["weight","sets"]', 'Back', '[]', 1, ?, ?)`,
      [Date.now(), Date.now()]
    );
    const strengthId = lastInsertId();

    const planResponse = responseRecorder();
    createTrainingPlan(
      { body: { name: 'Mobile day', startDate: '2020-04-01', endDate: '2020-04-30', status: 'active' } },
      planResponse
    );
    const sessionResponse = responseRecorder();
    createTrainingSession(
      {
        params: { planId: planResponse.body.id },
        body: {
          scheduledDate: '2020-04-05',
          items: [
            { exerciseId: aerobicId, targets: { duration: 30, distance: 3 } },
            { exerciseId: strengthId, targets: { weight: 40, sets: 3 } }
          ]
        }
      },
      sessionResponse
    );
    assert.equal(sessionResponse.statusCode, 201);
    insertSportRecord(db, { date: '2020-04-05', duration: 1500, distance: 1500 });

    const response = responseRecorder();
    getTrainingExecution({ query: { date: '2020-04-05' } }, response);
    assert.equal(response.statusCode, 200);
    const [session] = response.body.sessions;

    // 人工项目仍然只显示需要确认的那一项，自动项目单独返回，不混进确认流程。
    assert.equal(session.itemCount, 1);
    assert.equal(session.items[0].exercise.name, 'Lat pulldown');
    assert.equal(session.autoItemCount, 1);
    assert.equal(session.autoItems.length, 1);
    assert.equal(session.autoItems[0].exercise.name, 'Treadmill walk');
    assert.equal(session.autoItems[0].status, 'partial');
    assert.equal(session.autoItems[0].record.durationSeconds, 1500);
    assert.equal(session.autoItems[0].progress, 0.5);
  } finally {
    databaseService.close();
    config.dbPath = originalDbPath;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
