// 导入运动记录的读取入口。
// 桌面计划页和移动端今日训练都要按日期读取同一批记录，集中在这里避免两处各写一份 SQL。
import { databaseService } from './database.js';
import { normalizeSportRecordRow } from './aerobicMatching.js';

function queryRows(sql, params = []) {
  const result = databaseService.query(sql, params);
  if (result.length === 0) return [];
  return result[0].values.map((values) =>
    Object.fromEntries(result[0].columns.map((column, index) => [column, values[index]]))
  );
}

/**
 * 读取指定日期范围内的导入运动记录，并归一成匹配用的结构。
 * @param {string} startDate 起始日期
 * @param {string} endDate 结束日期
 * @returns {Array<object>} 归一后的运动记录
 */
export function loadNormalizedSportRecords(startDate, endDate) {
  if (!startDate || !endDate) return [];
  return queryRows(
    `SELECT id, category, "key" AS key, time, date, value
     FROM sport_records
     WHERE date >= ? AND date <= ?
     ORDER BY date, time`,
    [startDate, endDate]
  )
    .map(normalizeSportRecordRow)
    .filter(Boolean);
}

/**
 * 服务器本地日期，用于区分"训练单元还没到"和"确实没有导入数据"。
 * @returns {string} YYYY-MM-DD
 */
export function todayDateKey() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join(
    '-'
  );
}
