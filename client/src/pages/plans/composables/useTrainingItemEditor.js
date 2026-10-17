import { ref } from 'vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const DURATION_PARTS = ['hours', 'minutes', 'seconds'];
const DURATION_TARGET_KEYS = ['duration', 'durationSeconds', 'durationUnit'];

/**
 * 训练项目的编辑与展示。
 *
 * 「选动作 → 填目标 → 转成接口载荷」这套流程在批量规则、训练课、批量加课三处弹窗里一模一样，
 * 计划详情也要把同一份目标渲染成文案。实现只留这一份，避免三份各自演化后对不上。
 *
 * exercises 可以不传：只做文案渲染时不需要动作表。
 */
export function useTrainingItemEditor(exercises = ref([])) {
  const { t } = useLocaleStore();
  let itemKey = 0;

  function metricLabel(metric) {
    return t(`plans.exercise.metricOptions.${metric}`);
  }

  function unitLabel(metric) {
    return t(`plans.manager.units.${metric}`);
  }

  function metricPrecision(metric) {
    return ['distance', 'weight', 'speed', 'incline'].includes(metric) ? 1 : 0;
  }

  function durationPartLabel(part) {
    return t(`plans.manager.units.durationParts.${DURATION_PARTS.includes(part) ? part : 'seconds'}`);
  }

  function exerciseFor(id) {
    return exercises.value.find((exercise) => exercise.id === id) || null;
  }

  function metricsFor(item) {
    return exerciseFor(item?.exerciseId)?.metrics || [];
  }

  /** 候选动作：已启用的，且没有被同一份清单里的其他项目占用。 */
  function optionsFor(items, currentItem) {
    const selectedIds = new Set(items.filter((item) => item !== currentItem).map((item) => item.exerciseId));
    return exercises.value.filter(
      (exercise) => !selectedIds.has(exercise.id) && (exercise.enabled || exercise.id === currentItem.exerciseId)
    );
  }

  function canAddItem(items) {
    return exercises.value.some(
      (exercise) => exercise.enabled && !items.some((item) => item.exerciseId === exercise.id)
    );
  }

  function createItem(exerciseId = null, targets = {}) {
    itemKey += 1;
    const normalizedTargets = { ...targets };
    const durationParts = durationPartsFromTargets(normalizedTargets);
    for (const key of DURATION_TARGET_KEYS) delete normalizedTargets[key];
    return { key: itemKey, exerciseId, durationParts, targets: normalizedTargets };
  }

  /** 新建一个已选好动作的项目并初始化目标；动作都用完时返回 null，由调用方决定怎么提示。 */
  function createNextItem(items) {
    const selectedIds = new Set(items.map((item) => item.exerciseId));
    const exercise = exercises.value.find((candidate) => candidate.enabled && !selectedIds.has(candidate.id));
    if (!exercise) return null;
    const item = createItem(exercise.id);
    resetItemTargets(item);
    return item;
  }

  function resetItemTargets(item) {
    item.targets = Object.fromEntries(metricsFor(item).map((metric) => [metric, undefined]));
    item.durationParts = { hours: 0, minutes: 0, seconds: 0 };
  }

  /** 目标输入控件只上报改动，落到条目上的动作放在这里，控件本身不持有状态。 */
  function applyTargetUpdate(item, patch) {
    if (!patch) return;
    if (patch.metric === 'duration') {
      item.durationParts = patch.value;
      return;
    }
    item.targets[patch.metric] = patch.value;
  }

  function targetPayload(item) {
    const targets = Object.fromEntries(
      Object.entries(item.targets).filter(
        ([metric, value]) =>
          !DURATION_TARGET_KEYS.includes(metric) && Number.isFinite(Number(value)) && Number(value) > 0
      )
    );
    if (metricsFor(item).includes('duration')) {
      const seconds = durationSecondsFromParts(item.durationParts);
      if (seconds > 0) targets.durationSeconds = seconds;
    }
    return targets;
  }

  /**
   * 「量化目标填全」：这个训练项目支持的所有指标都要有大于 0 的值，时长也算。
   * 只填其中一项时，后续的完成度、容量等计算拿不到完整目标，所以按未填全处理。
   * 没有配置任何指标的项目没有可填目标，不在这里拦（应先去运动项目里补指标）。
   */
  function hasCompleteTargets(item) {
    const metrics = metricsFor(item);
    if (metrics.length === 0) return true;
    return metrics.every((metric) => {
      if (metric === 'duration') return durationSecondsFromParts(item.durationParts) > 0;
      const value = Number(item.targets?.[metric]);
      return Number.isFinite(value) && value > 0;
    });
  }

  function targetsText(item) {
    const parts = metricValuesText(item.targets || {}, durationSecondsFromParts(item.durationParts));
    return parts.length > 0 ? parts.join(t('common.listSeparator')) : t('plans.manager.noTargets');
  }

  function metricValuesText(values, fallbackDurationSeconds = 0) {
    const entries = Object.entries(values || {}).filter(([metric]) => !DURATION_TARGET_KEYS.includes(metric));
    const parts = [];
    const seconds = durationSecondsFromTargets(values || {}) || fallbackDurationSeconds;
    if (seconds > 0) parts.push(`${metricLabel('duration')} ${formatDurationText(seconds)}`);
    parts.push(...entries.map(([metric, value]) => `${metricLabel(metric)} ${value} ${unitLabel(metric)}`));
    return parts;
  }

  function durationSecondsFromTargets(targets) {
    if (Number.isFinite(Number(targets.durationSeconds)) && Number(targets.durationSeconds) > 0) {
      return Number(targets.durationSeconds);
    }
    if (!Number.isFinite(Number(targets.duration)) || Number(targets.duration) <= 0) return 0;
    return Number(targets.duration) * (targets.durationUnit === 'seconds' ? 1 : 60);
  }

  function durationPartsFromTargets(targets) {
    return durationPartsFromSeconds(durationSecondsFromTargets(targets));
  }

  function durationPartsFromSeconds(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    return {
      hours: Math.floor(seconds / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      seconds: seconds % 60
    };
  }

  function durationSecondsFromParts(parts = {}) {
    const hours = Math.max(0, Number(parts.hours) || 0);
    const minutes = Math.max(0, Number(parts.minutes) || 0);
    const seconds = Math.max(0, Number(parts.seconds) || 0);
    return Math.round(hours * 3600 + minutes * 60 + seconds);
  }

  function formatDurationText(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return [
      hours > 0 ? `${hours}${durationPartLabel('hours')}` : '',
      minutes > 0 ? `${minutes}${durationPartLabel('minutes')}` : '',
      remainder > 0 || (hours === 0 && minutes === 0) ? `${remainder}${durationPartLabel('seconds')}` : ''
    ]
      .filter(Boolean)
      .join(' ');
  }

  return {
    metricLabel,
    unitLabel,
    metricPrecision,
    durationPartLabel,
    exerciseFor,
    metricsFor,
    optionsFor,
    canAddItem,
    createItem,
    createNextItem,
    resetItemTargets,
    applyTargetUpdate,
    targetPayload,
    hasCompleteTargets,
    targetsText,
    metricValuesText,
    durationSecondsFromTargets,
    durationPartsFromTargets,
    durationPartsFromSeconds,
    durationSecondsFromParts,
    formatDurationText
  };
}
