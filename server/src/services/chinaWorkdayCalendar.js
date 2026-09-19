import { config } from '../config/index.js';
import { databaseService } from './database.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CALENDAR_TYPES = new Set(['public_holiday', 'transfer_workday']);

// A startup-safe baseline for the first supported year. Remote data refreshes it when available.
const embedded2026Days = [
  ['2026-01-01', 'public_holiday', '元旦'],
  ['2026-01-02', 'public_holiday', '元旦'],
  ['2026-01-03', 'public_holiday', '元旦'],
  ['2026-01-04', 'transfer_workday', '元旦补班'],
  ['2026-02-14', 'transfer_workday', '春节补班'],
  ['2026-02-15', 'public_holiday', '春节'],
  ['2026-02-16', 'public_holiday', '春节'],
  ['2026-02-17', 'public_holiday', '春节'],
  ['2026-02-18', 'public_holiday', '春节'],
  ['2026-02-19', 'public_holiday', '春节'],
  ['2026-02-20', 'public_holiday', '春节'],
  ['2026-02-21', 'public_holiday', '春节'],
  ['2026-02-22', 'public_holiday', '春节'],
  ['2026-02-23', 'public_holiday', '春节'],
  ['2026-02-28', 'transfer_workday', '春节补班'],
  ['2026-04-04', 'public_holiday', '清明节'],
  ['2026-04-05', 'public_holiday', '清明节'],
  ['2026-04-06', 'public_holiday', '清明节'],
  ['2026-05-01', 'public_holiday', '劳动节'],
  ['2026-05-02', 'public_holiday', '劳动节'],
  ['2026-05-03', 'public_holiday', '劳动节'],
  ['2026-05-04', 'public_holiday', '劳动节'],
  ['2026-05-05', 'public_holiday', '劳动节'],
  ['2026-05-09', 'transfer_workday', '劳动节补班'],
  ['2026-06-19', 'public_holiday', '端午节'],
  ['2026-06-20', 'public_holiday', '端午节'],
  ['2026-06-21', 'public_holiday', '端午节'],
  ['2026-09-20', 'transfer_workday', '国庆节补班'],
  ['2026-09-25', 'public_holiday', '中秋节'],
  ['2026-09-26', 'public_holiday', '中秋节'],
  ['2026-09-27', 'public_holiday', '中秋节'],
  ['2026-10-01', 'public_holiday', '国庆节'],
  ['2026-10-02', 'public_holiday', '国庆节'],
  ['2026-10-03', 'public_holiday', '国庆节'],
  ['2026-10-04', 'public_holiday', '国庆节'],
  ['2026-10-05', 'public_holiday', '国庆节'],
  ['2026-10-06', 'public_holiday', '国庆节'],
  ['2026-10-07', 'public_holiday', '国庆节'],
  ['2026-10-10', 'transfer_workday', '国庆节补班']
].map(([date, type, name]) => ({ date, type, name }));

function rows(sql, params = []) {
  const result = databaseService.query(sql, params)[0];
  if (!result) return [];
  return result.values.map((values) =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index]]))
  );
}

function getYearState(year) {
  return rows('SELECT * FROM china_calendar_years WHERE year = ?', [year])[0] || null;
}

function writeYearDays(year, days, source, now, successful) {
  const db = databaseService.getDb();
  db.run('BEGIN IMMEDIATE');
  try {
    db.run('DELETE FROM china_calendar_days WHERE date >= ? AND date < ?', [`${year}-01-01`, `${year + 1}-01-01`]);
    for (const day of days) {
      db.run(`INSERT INTO china_calendar_days (date, type, name, source, updated_at) VALUES (?, ?, ?, ?, ?)`, [
        day.date,
        day.type,
        day.name,
        source,
        now
      ]);
    }
    db.run(
      `INSERT INTO china_calendar_years (year, source, last_attempted_at, last_success_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(year) DO UPDATE SET
         source = excluded.source,
         last_attempted_at = excluded.last_attempted_at,
         last_success_at = excluded.last_success_at,
         updated_at = excluded.updated_at`,
      [year, source, now, successful ? now : 0, now]
    );
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

function recordFailedAttempt(year, now) {
  const db = databaseService.getDb();
  db.run(
    `INSERT INTO china_calendar_years (year, source, last_attempted_at, last_success_at, updated_at)
     VALUES (?, ?, ?, 0, ?)
     ON CONFLICT(year) DO UPDATE SET last_attempted_at = excluded.last_attempted_at, updated_at = excluded.updated_at`,
    [year, config.chinaCalendar.source, now, now]
  );
}

export function normalizeChinaCalendarPayload(payload, year) {
  if (!payload || payload.year !== year || payload.region !== 'CN' || !Array.isArray(payload.dates)) {
    throw new Error(`Invalid China calendar payload for ${year}`);
  }
  const byDate = new Map();
  for (const item of payload.dates) {
    if (!DATE_PATTERN.test(item?.date) || !item.date.startsWith(`${year}-`) || !CALENDAR_TYPES.has(item?.type)) {
      throw new Error(`Invalid China calendar day for ${year}`);
    }
    byDate.set(item.date, {
      date: item.date,
      type: item.type,
      name: String(item.name_cn || item.name || '').slice(0, 100)
    });
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function isChinaWorkday(date, override = null) {
  if (!DATE_PATTERN.test(date)) return false;
  if (override?.type === 'transfer_workday') return true;
  if (override?.type === 'public_holiday') return false;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function seedEmbeddedChinaCalendar() {
  const existing = getYearState(2026);
  if (existing) return false;
  writeYearDays(2026, embedded2026Days, 'embedded', Date.now(), false);
  return true;
}

function shouldRefresh(state, now) {
  return (
    !state ||
    !Number(state.last_success_at || 0) ||
    now - Number(state.last_attempted_at || 0) >= config.chinaCalendar.syncIntervalMs
  );
}

export async function refreshChinaCalendarYear(year, { force = false } = {}) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Invalid calendar year');
  const state = getYearState(year);
  const now = Date.now();
  if (!force && !shouldRefresh(state, now))
    return { year, refreshed: false, available: Boolean(state?.last_success_at || state?.source === 'embedded') };

  try {
    const response = await fetch(config.chinaCalendar.urlTemplate.replace('{year}', String(year)), {
      signal: AbortSignal.timeout(config.chinaCalendar.requestTimeoutMs),
      headers: { accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Calendar source returned ${response.status}`);
    const days = normalizeChinaCalendarPayload(await response.json(), year);
    writeYearDays(year, days, config.chinaCalendar.source, now, true);
    return { year, refreshed: true, available: true };
  } catch (error) {
    recordFailedAttempt(year, now);
    const fallback = getYearState(year);
    console.warn(`China calendar sync failed for ${year}: ${error.message}`);
    return { year, refreshed: false, available: Boolean(fallback?.last_success_at || fallback?.source === 'embedded') };
  }
}

export async function ensureChinaCalendarYears(years) {
  seedEmbeddedChinaCalendar();
  const uniqueYears = [...new Set(years)].filter(Number.isInteger);
  const results = await Promise.all(uniqueYears.map((year) => refreshChinaCalendarYear(year)));
  return results;
}

export async function initializeChinaWorkdayCalendar() {
  seedEmbeddedChinaCalendar();
  const year = new Date().getUTCFullYear();
  await refreshChinaCalendarYear(year);
}

export async function getChinaCalendarRange(startDate, endDate) {
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate) || startDate > endDate) {
    throw new Error('Invalid calendar date range');
  }
  const years = [];
  for (let year = Number(startDate.slice(0, 4)); year <= Number(endDate.slice(0, 4)); year += 1) years.push(year);
  const status = await ensureChinaCalendarYears(years);
  const overrides = rows(
    'SELECT date, type, name FROM china_calendar_days WHERE date >= ? AND date <= ? ORDER BY date',
    [startDate, endDate]
  );
  return {
    overrides,
    unavailableYears: status.filter((item) => !item.available).map((item) => item.year)
  };
}
