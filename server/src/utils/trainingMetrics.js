// 训练目标与实际记录共用同一套指标词汇表。
// 计划里的 targets 和训练后记录的 actuals 结构同构，便于桌面端逐项对照。
export const TRAINING_METRICS = [
  'duration',
  'durationSeconds',
  'distance',
  'sets',
  'repetitions',
  'weight',
  'speed',
  'incline',
  'resistance',
  'heart_rate',
  'calories'
];

const METRIC_SET = new Set(TRAINING_METRICS);

// 只允许整数的指标。重量按 0.5kg 递增，其余按 0.1 递增。
const INTEGER_METRICS = new Set(['sets', 'repetitions', 'resistance', 'heart_rate', 'calories', 'durationSeconds']);
const HALF_STEP_METRICS = new Set(['weight']);

export const SKIP_REASONS = ['equipment_busy', 'no_time', 'discomfort', 'too_hard', 'other'];

export function isTrainingMetric(metric) {
  return METRIC_SET.has(metric);
}

/**
 * 按指标类型量化数值：整数指标取整，重量对齐 0.5，其余对齐 0.1。
 * @param {string} metric 指标名
 * @param {number} value 原始数值
 * @returns {number} 量化后的数值
 */
export function quantizeMetricValue(metric, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return number;
  if (INTEGER_METRICS.has(metric)) return Math.round(number);
  if (HALF_STEP_METRICS.has(metric)) return Math.round(number * 2) / 2;
  return Math.round(number * 10) / 10;
}

/**
 * 实际记录比计划目标宽松：允许留空（用 null 表示“这项没记”）。
 * @param {string} metric 指标名
 * @param {unknown} rawValue 客户端提交的原始值
 * @param {Set<string>} supportedMetrics 该运动项目支持的指标
 * @returns {{ ok: true, value: number|null }|{ ok: false }} 校验结果
 */
export function normalizeActualValue(metric, rawValue, supportedMetrics) {
  if (!isTrainingMetric(metric) || !supportedMetrics.has(metric)) return { ok: false };
  if (rawValue === null || rawValue === undefined || rawValue === '') return { ok: true, value: null };

  const number = Number(rawValue);
  if (!Number.isFinite(number) || number < 0) return { ok: false };
  const quantized = quantizeMetricValue(metric, number);
  if (quantized < 0 || quantized > 100000) return { ok: false };
  return { ok: true, value: quantized };
}
