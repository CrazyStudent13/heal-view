import crypto from 'node:crypto';
import { parseHealthArchive, normalizeImportPlatform } from '@crazystudent13/health-archive-parser';
import { databaseService } from './database.js';
import { cacheManager } from './cacheManager.js';

const pendingImports = new Map();
const importHistory = [];
const MAX_HISTORY = 50;

const metricValueKeyMap = {
  steps: 'steps',
  calories: 'calories',
  distance: 'distance',
  heart_rate: 'bpm',
  stress: 'stress',
  weight: 'weight',
  spo2: 'spo2',
  intensity: 'intensity'
};

const metricUnits = {
  steps: '步',
  calories: 'kcal',
  distance: 'm',
  heart_rate: 'bpm',
  stress: '',
  weight: 'kg',
  spo2: '%',
  intensity: 'min'
};

const sleepStateCodeMap = {
  deep: 2,
  light: 3,
  rem: 4,
  awake: 5,
  wake: 5
};

function createImportId() {
  return crypto.randomUUID();
}

function normalizeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function getPlatformLabel(platform) {
  return platform === 'huawei' ? '华为运动健康' : '小米运动健康';
}

function formatMetricValue(series) {
  const summary = series.summary || {};
  const value = summary.sum ?? summary.avg ?? summary.max ?? summary.min;
  if (!Number.isFinite(Number(value))) return '--';
  const rounded = Math.round(Number(value) * 10) / 10;
  const unit = metricUnits[series.metricType] || series.unit || '';
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${unit ? ` ${unit}` : ''}`;
}

function formatLatestMetricValue(series) {
  const latest = [...(series.samples || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
  const value = latest?.value ?? series.summary?.avg ?? series.summary?.sum ?? series.summary?.max ?? series.summary?.min;
  if (!Number.isFinite(Number(value))) return '--';
  const rounded = Math.round(Number(value) * 10) / 10;
  const unit = metricUnits[series.metricType] || series.unit || '';
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${unit ? ` ${unit}` : ''}`;
}

function metricLabel(metricType) {
  return {
    steps: '步数',
    calories: '卡路里',
    distance: '距离',
    heart_rate: '心率',
    stress: '压力',
    weight: '体重',
    spo2: '血氧',
    intensity: '活动强度'
  }[metricType] || metricType;
}

function selectedSource(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.length > 1 ? `${candidate[0]} 等 ${candidate.length} 个文件` : candidate[0];
    }
    if (candidate) return candidate;
  }
  return '--';
}

function rangeFromDates(dates) {
  const validDates = dates.filter(Boolean).sort();
  if (validDates.length === 0) return '--';
  const start = validDates[0];
  const end = validDates[validDates.length - 1];
  return start === end ? start : `${start} ~ ${end}`;
}

function describeMetricGroup(seriesList) {
  const sorted = [...seriesList].sort((a, b) => (b.summary?.lastTimestamp || 0) - (a.summary?.lastTimestamp || 0));
  const latest = sorted[0];
  const samples = seriesList.reduce((sum, series) => sum + Number(series.summary?.sampleCount || series.samples?.length || 0), 0);
  return `${seriesList.length} 天，${samples} 条采样，最新 ${formatLatestMetricValue(latest)}`;
}

function describeProfile(profile) {
  if (!profile || Object.values(profile).every((value) => value == null || value === '')) return '未发现用户档案数据';
  const parts = [];
  if (Number.isFinite(Number(profile.heightCm))) parts.push(`身高 ${profile.heightCm} cm`);
  if (Number.isFinite(Number(profile.initialWeightKg))) parts.push(`初始体重 ${profile.initialWeightKg} kg`);
  if (Number.isFinite(Number(profile.targetWeightKg))) parts.push(`目标体重 ${profile.targetWeightKg} kg`);
  if (Number.isFinite(Number(profile.dailyCalorieGoal))) parts.push(`热量目标 ${profile.dailyCalorieGoal} kcal`);
  return parts.length > 0 ? parts.join(' / ') : '已读取用户档案';
}

function buildPreviewRows(normalized) {
  const selectedFiles = normalized.source?.archive?.selectedFiles || {};
  const rows = [];

  rows.push({
    date: '--',
    category: '用户档案',
    value: describeProfile(normalized.profile),
    target: 'user_profiles',
    source: selectedSource(selectedFiles.profile, selectedFiles.memberProfile, selectedFiles.fitnessProfile, selectedFiles.fitness)
  });

  for (const metric of ['steps', 'distance', 'calories', 'heart_rate', 'stress', 'weight', 'spo2', 'intensity']) {
    const seriesList = (normalized.metricSeries || []).filter((item) => item.metricType === metric);
    if (seriesList.length === 0) continue;
    rows.push({
      date: rangeFromDates(seriesList.map((series) => series.date)),
      category: metricLabel(metric),
      value: describeMetricGroup(seriesList),
      target: 'health_metric_series',
      source: selectedSource(selectedFiles.aggregated, selectedFiles.fitness, selectedFiles.health, selectedFiles.sportPerMinute)
    });
  }

  if (normalized.sleepSessions?.length) {
    const sessions = normalized.sleepSessions;
    const totalHours = Math.round((sessions.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0) / 60) * 10) / 10;
    rows.push({
      date: rangeFromDates(sessions.map((session) => session.date)),
      category: '睡眠',
      value: `${sessions.length} 次睡眠，累计 ${totalHours} h，阶段 ${sessions.reduce((sum, session) => sum + (session.stages?.length || 0), 0)} 段`,
      target: 'sleep_sessions',
      source: selectedSource(selectedFiles.sampleSequence, selectedFiles.fitness, selectedFiles.health)
    });
  }

  if (normalized.sportRecords?.length) {
    const records = normalized.sportRecords;
    const minutes = Math.round(records.reduce((sum, record) => sum + Number(record.durationSeconds || 0), 0) / 60);
    const distance = Math.round(records.reduce((sum, record) => sum + Number(record.distanceMeters || 0), 0));
    rows.push({
      date: rangeFromDates(records.map((record) => record.date)),
      category: '活动记录',
      value: `${records.length} 条记录，累计 ${minutes} min，${distance} m，类型 ${records[0].sportType || records[0].category || '--'}`,
      target: 'sport_records',
      source: selectedSource(selectedFiles.sports, selectedFiles.sportPerMinute, selectedFiles.motionPath)
    });
  }

  if (!(normalized.metricSeries || []).some((item) => item.metricType === 'blood_pressure')) {
    rows.push({
      date: '--',
      category: '血压',
      value: '当前未发现可映射血压数据',
      target: 'blood_pressure_records',
      source: '--'
    });
  }

  if (rows.length <= 1) {
    return (normalized.metricSeries || []).slice(0, 12).map((series) => ({
      date: series.date,
      category: metricLabel(series.metricType),
      value: formatMetricValue(series),
      target: 'health_metric_series',
      source: selectedSource(selectedFiles.fitness, selectedFiles.aggregated, selectedFiles.health)
    }));
  }

  return rows.slice(0, 12);
}

function collectImportDates(normalized) {
  const dates = new Set();
  for (const series of normalized.metricSeries || []) dates.add(series.date);
  for (const session of normalized.sleepSessions || []) dates.add(session.date);
  for (const record of normalized.sportRecords || []) dates.add(record.date);
  return [...dates].filter(Boolean);
}

function rowCount(normalized) {
  const counts = normalized.summary?.counts || {};
  return Number(counts.metricSamples || 0)
    + Number(counts.sleepSessions || 0)
    + Number(counts.sportRecords || 0);
}

function addHistory(entry) {
  importHistory.unshift(entry);
  importHistory.splice(MAX_HISTORY);
}

function insertFitnessRow(stmt, { uid, sid, key, time, date, value, updateTime }) {
  stmt.run(uid, sid, key, time, date, json(value), updateTime);
}

function metricSampleValue(metricType, sample) {
  const valueKey = metricValueKeyMap[metricType] || 'value';
  return {
    [valueKey]: normalizeNumber(sample.value),
    source: 'health_archive_parser'
  };
}

function sleepValue(session) {
  return {
    bedtime: session.bedtime,
    wake_up_time: session.wakeUp,
    duration: normalizeNumber(session.durationMinutes),
    sleep_deep_duration: normalizeNumber(session.deepSleepMinutes),
    sleep_light_duration: normalizeNumber(session.lightSleepMinutes),
    sleep_rem_duration: normalizeNumber(session.remSleepMinutes),
    sleep_awake_duration: normalizeNumber(session.awakeMinutes),
    avg_hrm: session.avgHeartRate,
    session_type: session.sessionType,
    items: (session.stages || []).map((stage) => ({
      start_time: stage.startAt,
      end_time: stage.endAt,
      state: sleepStateCodeMap[stage.state] || 0
    })),
    source: session.source || {}
  };
}

function sportValue(record) {
  const details = record.details && typeof record.details === 'object' ? record.details : {};
  return {
    ...details,
    sport_type: details.sport_type,
    category: record.category || record.sportType || 'other',
    start_time: record.startedAt,
    end_time: record.endedAt,
    duration: normalizeNumber(record.durationSeconds),
    distance: normalizeNumber(record.distanceMeters),
    calories: normalizeNumber(record.calories),
    steps: normalizeNumber(record.steps),
    avg_hrm: record.avgHeartRate,
    max_hrm: record.maxHeartRate,
    source: record.source || {}
  };
}

function buildDailyAggregates(normalized) {
  const byDate = new Map();
  for (const series of normalized.metricSeries || []) {
    if (!['steps', 'calories', 'distance'].includes(series.metricType)) continue;
    const current = byDate.get(series.date) || { steps: 0, calories: 0, distance: 0, time: series.summary?.lastTimestamp || 0 };
    const value = normalizeNumber(series.summary?.sum ?? series.summary?.max ?? series.summary?.avg);
    current[series.metricType] = Math.max(current[series.metricType] || 0, value);
    current.time = Math.max(current.time || 0, normalizeNumber(series.summary?.lastTimestamp));
    byDate.set(series.date, current);
  }
  return byDate;
}

function deleteDates(db, dates) {
  if (dates.length === 0) return;
  const placeholders = dates.map(() => '?').join(',');
  db.prepare(`DELETE FROM fitness_data WHERE date IN (${placeholders})`).run(...dates);
  db.prepare(`DELETE FROM sport_records WHERE date IN (${placeholders})`).run(...dates);
  db.prepare(`DELETE FROM aggregated_data WHERE date IN (${placeholders})`).run(...dates);
}

export async function parseArchiveFile(file, platform) {
  const normalizedPlatform = normalizeImportPlatform(platform);
  const normalized = await parseHealthArchive(file.path, {
    platform: normalizedPlatform,
    timezone: 'Asia/Shanghai'
  });
  const importId = createImportId();
  const createdAt = new Date().toISOString();
  const previewRows = buildPreviewRows(normalized);
  const dates = collectImportDates(normalized);

  const summary = {
    importId,
    importStatus: 'pending',
    canImport: true,
    platform: normalizedPlatform,
    platformLabel: getPlatformLabel(normalizedPlatform),
    fileName: file.originalname,
    fileSize: file.size,
    createdAt,
    previewRows,
    issues: normalized.issues || [],
    summary: normalized.summary,
    source: normalized.source
  };

  pendingImports.set(importId, { normalized, summary, dates });
  addHistory({
    id: importId,
    importId,
    platform: normalizedPlatform,
    platformLabel: getPlatformLabel(normalizedPlatform),
    fileName: file.originalname,
    fileSize: file.size,
    createdAt,
    status: 'pending',
    overview: normalized.summary?.dateRange
      ? `${normalized.summary.dateRange.start} 至 ${normalized.summary.dateRange.end}，共 ${rowCount(normalized)} 条记录`
      : `共 ${rowCount(normalized)} 条记录`,
    result: {
      status: normalized.issues?.length ? 'partial' : 'success',
      previewItems: previewRows,
      reasons: (normalized.issues || []).map((issue) => issue.message || issue.code)
    }
  });

  return summary;
}

export function importParsedArchive(importId) {
  const pending = pendingImports.get(importId);
  if (!pending) {
    const error = new Error('导入记录已过期，请重新解析压缩包');
    error.status = 404;
    throw error;
  }

  const { normalized, dates } = pending;
  const rawDb = databaseService.db;
  const now = Math.floor(Date.now() / 1000);
  const uid = normalized.profile?.providerAccountKey || normalized.source?.provider || 'health_archive';
  const sid = normalized.schemaVersion || normalized.source?.provider || 'health_archive';

  rawDb.exec('BEGIN');
  try {
    deleteDates(rawDb, dates);

    const fitnessStmt = rawDb.prepare(`
      INSERT INTO fitness_data (uid, sid, key, time, date, value, update_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const sportStmt = rawDb.prepare(`
      INSERT INTO sport_records (uid, sid, category, key, time, date, value, parsed_value, update_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const aggregateStmt = rawDb.prepare(`
      INSERT INTO aggregated_data (uid, sid, tag, key, time, date, value, update_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let fitnessRows = 0;
    let sportRows = 0;
    let aggregateRows = 0;

    for (const series of normalized.metricSeries || []) {
      for (const sample of series.samples || []) {
        insertFitnessRow(fitnessStmt, {
          uid,
          sid,
          key: series.metricType,
          time: sample.timestamp,
          date: series.date,
          value: metricSampleValue(series.metricType, sample),
          updateTime: now
        });
        fitnessRows += 1;
      }
    }

    for (const session of normalized.sleepSessions || []) {
      insertFitnessRow(fitnessStmt, {
        uid,
        sid,
        key: 'sleep',
        time: session.bedtime,
        date: session.date,
        value: sleepValue(session),
        updateTime: now
      });
      fitnessRows += 1;
    }

    if (normalized.profile) {
      insertFitnessRow(fitnessStmt, {
        uid,
        sid,
        key: 'user_profile',
        time: now,
        date: dates[0] || new Date().toISOString().slice(0, 10),
        value: normalized.profile,
        updateTime: now
      });
      fitnessRows += 1;
    }

    for (const record of normalized.sportRecords || []) {
      const value = sportValue(record);
      sportStmt.run(
        uid,
        sid,
        record.category || record.sportType || 'other',
        record.sportType || 'sport',
        record.startedAt,
        record.date,
        json(value),
        json(value),
        now
      );
      sportRows += 1;
    }

    for (const [date, aggregate] of buildDailyAggregates(normalized)) {
      aggregateStmt.run(
        uid,
        sid,
        'daily',
        'steps',
        aggregate.time || now,
        date,
        json({
          steps: Math.round(aggregate.steps || 0),
          distance: Math.round(aggregate.distance || 0),
          calories: Math.round(aggregate.calories || 0)
        }),
        now
      );
      aggregateRows += 1;
    }

    rawDb.exec('COMMIT');
    pendingImports.delete(importId);
    cacheManager.flushAll();

    const historyItem = importHistory.find((item) => item.importId === importId);
    if (historyItem) {
      historyItem.status = 'completed';
      historyItem.completedAt = new Date().toISOString();
      historyItem.importedRows = { fitnessRows, sportRows, aggregateRows };
    }

    return {
      importId,
      importStatus: 'completed',
      importedRows: { fitnessRows, sportRows, aggregateRows },
      dateRange: normalized.summary?.dateRange || null
    };
  } catch (error) {
    rawDb.exec('ROLLBACK');
    const historyItem = importHistory.find((item) => item.importId === importId);
    if (historyItem) {
      historyItem.status = 'failed';
      historyItem.error = error.message;
    }
    throw error;
  }
}

export function listImportHistory() {
  return importHistory;
}

export function deleteImportHistory(importId) {
  pendingImports.delete(importId);
  const index = importHistory.findIndex((item) => item.importId === importId || item.id === importId);
  if (index >= 0) importHistory.splice(index, 1);
}

export function clearImportedData() {
  const db = databaseService.db;
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM fitness_data; DELETE FROM sport_records; DELETE FROM aggregated_data;');
    db.exec('COMMIT');
    pendingImports.clear();
    importHistory.length = 0;
    cacheManager.flushAll();
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
