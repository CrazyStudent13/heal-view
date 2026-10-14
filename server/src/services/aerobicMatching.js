// 有氧训练自动匹配：把导入的运动记录按"日期 + 运动类型"对应到计划里的自动验证项目。
//
// 设计约定：
//   - 只做匹配和达标判断，不写回训练计划；改计划不会受导入数据影响，重新导入后结果自动重算。
//   - 区分"没有导入数据"（no_data）和"训练未完成"，数据缺失不会被判定成失败。
//   - 目标与实际值都按归档口径换算：时长秒、距离公里、热量千卡。
import { recordMatchesSportTypes } from '../utils/sportTypes.js';

/** 可以自动核对的目标指标。 */
export const VERIFIABLE_METRICS = ['durationSeconds', 'distance', 'calories'];

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * 从训练项目目标里取出可自动核对的部分。
 * @param {object} targets 训练项目的目标值
 * @returns {Array<{ metric: string, target: number }>} 可核对目标，按固定顺序排列
 */
export function extractVerifiableTargets(targets = {}) {
  const normalized = targets && typeof targets === 'object' ? targets : {};
  const result = [];
  const durationSeconds = resolveTargetDurationSeconds(normalized);
  if (durationSeconds) result.push({ metric: 'durationSeconds', target: durationSeconds });
  const distance = toPositiveNumber(normalized.distance);
  if (distance) result.push({ metric: 'distance', target: distance });
  const calories = toPositiveNumber(normalized.calories);
  if (calories) result.push({ metric: 'calories', target: calories });
  return result;
}

/**
 * 目标时长统一成秒。计划里既可能有 durationSeconds，也可能是 duration + durationUnit 的旧结构。
 * @param {object} targets 训练项目的目标值
 * @returns {number|null} 目标秒数
 */
export function resolveTargetDurationSeconds(targets = {}) {
  const explicit = toPositiveNumber(targets.durationSeconds);
  if (explicit) return explicit;
  const duration = toPositiveNumber(targets.duration);
  if (!duration) return null;
  return targets.durationUnit === 'seconds' ? duration : duration * 60;
}

/**
 * 从导入运动记录里取出某个可核对指标的实际值，并换算到与目标相同的单位。
 * @param {object} record 归一后的运动记录
 * @param {string} metric 指标名
 * @returns {number|null} 实际值；记录里没有这项时返回 null
 */
function readRecordMetric(record, metric) {
  if (!record) return null;
  if (metric === 'durationSeconds') return toPositiveNumber(record.durationSeconds);
  if (metric === 'distance') {
    const meters = toPositiveNumber(record.distanceMeters);
    return meters ? meters / 1000 : null;
  }
  if (metric === 'calories') return toPositiveNumber(record.calories);
  return null;
}

/**
 * 计算单条记录相对目标的完成比例。
 * 取所有可对比指标里最弱的一项，避免"距离够了但时长差很多"被算成达标。
 * @returns {number|null} 完成比例；记录缺少全部可对比指标时返回 null
 */
function progressForRecord(targets, record) {
  const ratios = [];
  for (const { metric, target } of targets) {
    const actual = readRecordMetric(record, metric);
    if (actual === null) continue;
    ratios.push(actual / target);
  }
  if (ratios.length === 0) return null;
  return Math.min(...ratios);
}

/**
 * 把导入运动记录行归一成匹配用的结构。
 * @param {object} row sport_records 表的一行
 * @returns {object|null} 归一后的记录；value 无法解析时返回 null
 */
export function normalizeSportRecordRow(row) {
  if (!row) return null;
  let value = row.value;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  if (!value || typeof value !== 'object') value = {};
  return {
    id: row.id == null ? null : Number(row.id),
    date: row.date,
    category: row.category || value.category || '',
    sportType: value.sport_type ?? null,
    startTime: toPositiveNumber(value.start_time) || toPositiveNumber(row.time) || null,
    durationSeconds: toPositiveNumber(value.duration),
    distanceMeters: toPositiveNumber(value.distance),
    calories: toPositiveNumber(value.calories),
    // 供 recordMatchesSportTypes 判断运动类型用的原始字段。
    raw: { sport_type: value.sport_type, category: row.category || value.category, key: row.key }
  };
}

/**
 * 按日期与运动类型筛选候选记录。
 * @param {Array<object>} records 归一后的运动记录
 * @param {string} scheduledDate 训练单元日期
 * @param {string[]} sportTypes 训练项目配置的导入运动类型
 * @returns {Array<object>} 候选记录
 */
export function findCandidateRecords(records, scheduledDate, sportTypes) {
  if (!Array.isArray(records) || records.length === 0) return [];
  return records.filter((record) => record.date === scheduledDate && recordMatchesSportTypes(sportTypes, record.raw));
}

/**
 * 评估一个自动验证项目在某一天的实际完成情况。
 *
 * 状态含义：
 *   - achieved / partial：找到了导入记录，按目标比例判定达标或部分达标
 *   - no_data：该日期没有任何匹配的导入记录（当天或未来日期返回 planned）
 *   - unverifiable：项目没有可核对目标，或匹配到的记录缺少全部可核对指标
 * @param {object} params 评估入参
 * @param {object} params.targets 训练项目目标
 * @param {string[]} params.sportTypes 训练项目配置的导入运动类型
 * @param {Array<object>} params.records 归一后的运动记录
 * @param {string} params.scheduledDate 训练单元日期
 * @param {string} params.today 今天的日期，用于区分"还没到"和"没有数据"
 * @returns {object} 评估结果
 */
export function evaluateAerobicItem({ targets, sportTypes, records, scheduledDate, today }) {
  const configuredSportTypes = Array.isArray(sportTypes) ? sportTypes : [];
  const verifiableTargets = extractVerifiableTargets(targets);
  const verifiable = configuredSportTypes.length > 0 && verifiableTargets.length > 0;

  if (configuredSportTypes.length === 0) {
    return buildResult('unverifiable', 'no_sport_types', null, 0, false);
  }
  if (verifiableTargets.length === 0) {
    return buildResult('unverifiable', 'no_target', null, 0, false);
  }

  const candidates = findCandidateRecords(records, scheduledDate, configuredSportTypes);
  if (candidates.length === 0) {
    // 尚未发生的训练单元保持"待开始"，不因为暂时没有数据而报成缺数据。
    const upcoming = Boolean(scheduledDate && today && scheduledDate >= today);
    return buildResult(upcoming ? 'planned' : 'no_data', upcoming ? 'pending' : 'no_record', null, 0, verifiable);
  }

  const scored = candidates
    .map((record) => ({ record, progress: progressForRecord(verifiableTargets, record) }))
    .filter((entry) => entry.progress !== null);

  if (scored.length === 0) {
    // 有记录但记录里没有可对比的字段（例如手表只记了步数）。
    return buildResult('unverifiable', 'record_missing_metrics', candidates[0], candidates.length, verifiable);
  }

  // 同日多条记录时选最接近目标的一条，并标记为待确认。
  const best = scored.reduce((current, entry) => (entry.progress > current.progress ? entry : current));
  // 找到了记录就说明人确实练了：达到目标算达标，没达到只算部分达标，不判成失败。
  const status = best.progress >= 1 ? 'achieved' : 'partial';

  return {
    ...buildResult(status, 'matched', best.record, candidates.length, verifiable),
    progress: round(best.progress),
    matchedMetrics: verifiableTargets.map(({ metric, target }) => ({
      metric,
      target,
      actual: readRecordMetric(best.record, metric),
      ratio: ratioOrNull(readRecordMetric(best.record, metric), target)
    }))
  };
}

function buildResult(status, reason, record, candidateCount = 0, verifiable = false) {
  return {
    status,
    reason,
    verifiable,
    progress: null,
    candidateCount,
    ambiguous: candidateCount > 1,
    matchedMetrics: [],
    record: record ? serializeMatchedRecord(record) : null
  };
}

function serializeMatchedRecord(record) {
  return {
    id: record.id,
    date: record.date,
    category: record.category || '',
    startTime: record.startTime,
    durationSeconds: record.durationSeconds,
    distanceMeters: record.distanceMeters,
    calories: record.calories
  };
}

function ratioOrNull(actual, target) {
  if (actual === null || !target) return null;
  return round(actual / target);
}

function round(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}

/**
 * 统计一组项目验证结果的分布。
 * @param {Array<{status: string}>} results 项目验证结果
 * @returns {{ achieved: number, partial: number, noData: number, unverifiable: number, planned: number, total: number }}
 */
export function summarizeItemResults(results = []) {
  const summary = { achieved: 0, partial: 0, noData: 0, unverifiable: 0, planned: 0, total: results.length };
  for (const result of results) {
    if (!result) continue;
    if (result.status === 'achieved') summary.achieved += 1;
    else if (result.status === 'partial') summary.partial += 1;
    else if (result.status === 'no_data') summary.noData += 1;
    else if (result.status === 'unverifiable') summary.unverifiable += 1;
    else summary.planned += 1;
  }
  return summary;
}

/**
 * 汇总数据覆盖率与可验证完成率。
 * 两者分开返回：覆盖率说明"有多少项目真的能验证"，完成率只在有数据的项目上计算，
 * 合并成一个总分会让"没导入数据"看起来像"没完成"。
 * @param {Array<{ verifiable: boolean, status: string }>} itemResults 项目验证结果
 * @returns {{ verifiableItems: number, matchedItems: number, coverageRate: number|null, achievedItems: number, partialItems: number, verifiableCompletionRate: number|null }}
 */
export function summarizeCoverage(itemResults = []) {
  const verifiable = itemResults.filter((result) => result?.verifiable);
  const matched = verifiable.filter((result) => result.status === 'achieved' || result.status === 'partial');
  const achieved = matched.filter((result) => result.status === 'achieved').length;
  return {
    verifiableItems: verifiable.length,
    matchedItems: matched.length,
    coverageRate: rate(matched.length, verifiable.length),
    achievedItems: achieved,
    partialItems: matched.length - achieved,
    verifiableCompletionRate: rate(achieved, matched.length)
  };
}

function rate(numerator, denominator) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}
