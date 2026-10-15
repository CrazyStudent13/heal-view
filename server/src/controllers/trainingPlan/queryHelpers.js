// 训练计划领域共用的 SQL 读取与 JSON 解析原语。
// 计划、阶段、课次三个职责模块都从这里取，避免各写一份结果集转换。
import { databaseService } from '../../services/database.js';

function queryRows(sql, params = []) {
  const result = databaseService.query(sql, params);
  if (result.length === 0) return [];
  return result[0].values.map((values) =>
    Object.fromEntries(result[0].columns.map((column, index) => [column, values[index]]))
  );
}

function queryRow(sql, params = []) {
  return queryRows(sql, params)[0] || null;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export { parseJson, queryRow, queryRows };
