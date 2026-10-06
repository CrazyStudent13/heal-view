<template>
  <article class="item-panel">
    <header class="item-panel__header">
      <div class="item-panel__title">
        <h3>{{ item.exercise.name }}</h3>
        <van-tag plain type="primary" size="medium">{{ t('plans.exercise.verificationModes.manual') }}</van-tag>
      </div>
      <p class="item-panel__targets">
        <span class="item-panel__label">{{ t('mobile.targets') }}</span>
        {{ targetsText }}
      </p>
    </header>

    <p v-if="lastAttemptText" class="item-panel__last">{{ t('mobile.lastAttempt', { text: lastAttemptText }) }}</p>

    <div class="item-panel__metrics">
      <!-- 组数单独作为完成度呈现：分母是目标组数，分子是实际做了几组 -->
      <div v-if="targetSets > 0" class="metric-row">
        <span class="metric-row__label">{{ t('mobile.completedSets') }}</span>
        <div class="metric-row__control">
          <van-stepper
            :model-value="completedSets"
            :min="0"
            :max="targetSets"
            integer
            button-size="32px"
            :aria-label="t('mobile.completedSets')"
            @update:model-value="updateCompletedSets"
          />
          <small class="metric-row__unit">{{ t('mobile.setsOfTarget', { target: targetSets }) }}</small>
        </div>
      </div>

      <div v-for="metric in targets" :key="metric" class="metric-row">
        <span class="metric-row__label">{{ metricLabel(metric) }}</span>

        <div v-if="metric === 'duration'" class="duration-input">
          <div v-for="part in durationPartsList" :key="part" class="duration-part">
            <van-stepper
              :model-value="durationParts[part]"
              :min="0"
              :max="part === 'hours' ? 9 : 59"
              integer
              button-size="32px"
              :aria-label="durationPartLabel(part)"
              @update:model-value="(value) => updateDurationPart(part, value)"
            />
            <small>{{ durationPartLabel(part) }}</small>
          </div>
        </div>

        <div v-else class="metric-row__control">
          <van-stepper
            :model-value="actuals[metric] ?? 0"
            :min="0"
            :max="99999"
            :step="metricStep(metric)"
            :decimal-length="metricPrecision(metric)"
            :input-width="metricPrecision(metric) > 0 ? '58px' : '48px'"
            button-size="32px"
            :aria-label="metricLabel(metric)"
            @update:model-value="(value) => setMetricValue(metric, value)"
          />
          <small class="metric-row__unit">{{ unitLabel(metric) }}</small>
        </div>
      </div>
    </div>

    <p v-if="targetSets > 0 && completedSets < targetSets" class="item-panel__hint">
      {{ t('mobile.partialSets', { done: completedSets, target: targetSets }) }}
    </p>

    <div class="item-panel__actions">
      <van-button
        class="status-button"
        :type="isComplete ? 'primary' : 'default'"
        icon="success"
        block
        @click="$emit('set-complete', true)"
      >
        {{ t('mobile.itemDone') }}
      </van-button>
      <van-button
        class="status-button"
        :type="isSkipped ? 'warning' : 'default'"
        icon="arrow"
        block
        @click="$emit('set-complete', false)"
      >
        {{ t('mobile.itemSkipped') }}
      </van-button>
    </div>

    <button v-if="isSkipped" type="button" class="item-panel__skip-trigger" @click="skipSheetVisible = true">
      <span class="item-panel__skip-label">{{ t('mobile.skipReasonLabel') }}</span>
      <span class="item-panel__skip-value">{{
        skipReason ? t(`mobile.skipReasons.${skipReason}`) : t('mobile.chooseReason')
      }}</span>
      <van-icon name="arrow" />
    </button>

    <van-field
      :model-value="note"
      class="item-panel__note"
      type="textarea"
      rows="2"
      autosize
      maxlength="500"
      :placeholder="t('mobile.itemNotePlaceholder')"
      @update:model-value="(value) => $emit('update', { note: value })"
    />

    <van-action-sheet
      v-model:show="skipSheetVisible"
      :actions="skipActions"
      :cancel-text="t('common.cancel')"
      close-on-click-action
      safe-area-inset-bottom
      @select="handleSkipSelect"
    />
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  item: { type: Object, required: true },
  actuals: { type: Object, default: () => ({}) },
  skipReason: { type: String, default: '' },
  note: { type: String, default: '' }
});

const emit = defineEmits(['update', 'set-complete']);

const { t } = useLocaleStore();

const skipReasons = ['equipment_busy', 'no_time', 'discomfort', 'too_hard', 'other'];
const durationPartsList = ['hours', 'minutes', 'seconds'];
// 重量按 0.5 递增最贴近器械配重片，其余计数类指标按 1 递增。
const METRIC_STEPS = { weight: 0.5 };
const HALF_STEP_METRICS = new Set(['weight']);

const skipSheetVisible = ref(false);
const durationParts = ref({ hours: 0, minutes: 0, seconds: 0 });

const skipActions = computed(() =>
  skipReasons.map((reason) => ({ name: t(`mobile.skipReasons.${reason}`), value: reason }))
);

const targets = computed(() => {
  // 组数在「已完成组数」里单独呈现，不再作为普通指标重复出现。
  const target = props.item.targets || {};
  const keys = Object.keys(target).filter((metric) => metric !== 'durationSeconds' && metric !== 'sets');
  // 只显示这个运动项目真正支持的指标，避免历史遗留下来的无效目标继续显示。
  const supported = new Set(props.item.exercise?.metrics || []);
  const visible = keys.filter((metric) => supported.has(metric));
  // duration 与 durationSeconds 是同一件事的两种写法，展示时统一成 duration。
  if (
    (supported.has('duration') || supported.has('durationSeconds')) &&
    (target.duration != null || target.durationSeconds != null)
  ) {
    visible.unshift('duration');
  }
  return visible;
});

// 目标组数来自训练单元计划；实际完成了多少组由录入值决定。
const targetSets = computed(() => {
  const value = Number(props.item.targets?.sets);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
});
const completedSets = computed(() => {
  const value = Number(props.actuals?.sets);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
});

// 完成度完全由组数决定，面板上的按钮高亮也读同一个值，避免两处状态各说各话。
const isComplete = computed(() =>
  targetSets.value > 0 ? completedSets.value >= targetSets.value : completedSets.value > 0
);
const isSkipped = computed(() => completedSets.value === 0);

function updateCompletedSets(value) {
  const next = Math.max(0, Math.round(Number(value) || 0));
  emit('update', { actuals: { ...props.actuals, sets: next > 0 ? next : null } });
}

// 已记录的时长优先，其次沿用目标时长，最后从上次成绩预填。
watch(
  () => [props.item, props.actuals],
  () => {
    const seconds = resolveDurationSeconds();
    durationParts.value = {
      hours: Math.floor(seconds / 3600),
      minutes: Math.floor((seconds % 3600) / 60),
      seconds: seconds % 60
    };
  },
  { immediate: true, deep: true }
);

function handleSkipSelect(action) {
  emit('update', { skipReason: action.value });
}

function resolveDurationSeconds() {
  const recorded = Number(props.actuals?.durationSeconds);
  if (Number.isFinite(recorded) && recorded > 0) return recorded;

  const target = props.item.targets || {};
  if (Number.isFinite(Number(target.durationSeconds)) && Number(target.durationSeconds) > 0) {
    return Number(target.durationSeconds);
  }
  if (Number.isFinite(Number(target.duration)) && Number(target.duration) > 0) {
    return Math.round(Number(target.duration) * (target.durationUnit === 'seconds' ? 1 : 60));
  }

  const previous = Number(props.item.lastActuals?.durationSeconds);
  if (Number.isFinite(previous) && previous > 0) return previous;
  return 0;
}

// 时长只在 durationSeconds 上落值，避免同一件事出现两个字段各存一半。
function updateDurationPart(part, value) {
  const next = { ...durationParts.value, [part]: Math.max(0, Math.round(Number(value) || 0)) };
  durationParts.value = next;
  emit('update', {
    actuals: { ...props.actuals, durationSeconds: next.hours * 3600 + next.minutes * 60 + next.seconds }
  });
}

function setMetricValue(metric, value) {
  const normalized = value === null || value === '' ? null : Math.max(0, Number(value));
  emit('update', { actuals: { ...props.actuals, [metric]: Number.isFinite(normalized) ? normalized : null } });
}

function metricLabel(metric) {
  return t(`plans.exercise.metricOptions.${metric}`);
}

function unitLabel(metric) {
  return t(`plans.manager.units.${metric}`);
}

function metricPrecision(metric) {
  return HALF_STEP_METRICS.has(metric) ? 1 : 0;
}

function metricStep(metric) {
  return METRIC_STEPS[metric] || 1;
}

function durationPartLabel(part) {
  return t(`plans.manager.units.durationParts.${durationPartsList.includes(part) ? part : 'seconds'}`);
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return [
    Math.floor(total / 3600) > 0 ? `${Math.floor(total / 3600)}${durationPartLabel('hours')}` : '',
    Math.floor((total % 3600) / 60) > 0 ? `${Math.floor((total % 3600) / 60)}${durationPartLabel('minutes')}` : '',
    total % 60 > 0 || total === 0 ? `${total % 60}${durationPartLabel('seconds')}` : ''
  ]
    .filter(Boolean)
    .join('');
}

const targetsText = computed(() => {
  const parts = [];
  const seconds = targetDurationSeconds();
  if (seconds > 0) parts.push(formatDuration(seconds));
  for (const [metric, value] of Object.entries(props.item.targets || {})) {
    // 组数由完成度控件承载，这里不再重复；时长已折算成秒单独呈现。
    if (metric === 'duration' || metric === 'durationSeconds' || metric === 'sets') continue;
    parts.push(`${metricLabel(metric)} ${value}${unitLabel(metric)}`);
  }
  if (targetSets.value > 0) parts.push(`${metricLabel('sets')} ${targetSets.value}${unitLabel('sets')}`);
  return parts.length > 0 ? parts.join(t('common.listSeparator')) : t('plans.manager.noTargets');
});

function targetDurationSeconds() {
  const target = props.item.targets || {};
  if (Number(target.durationSeconds) > 0) return Math.round(Number(target.durationSeconds));
  if (Number(target.duration) > 0) {
    return Math.round(Number(target.duration) * (target.durationUnit === 'seconds' ? 1 : 60));
  }
  return 0;
}

const lastAttemptText = computed(() => {
  const previous = props.item.lastActuals;
  if (!previous || typeof previous !== 'object') return '';
  const parts = Object.entries(previous)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([metric, value]) =>
      metric === 'durationSeconds' ? formatDuration(value) : `${metricLabel(metric)} ${value}${unitLabel(metric)}`
    );
  if (parts.length === 0) return '';
  const date = props.item.lastPerformedAt ? `${props.item.lastPerformedAt} · ` : '';
  return `${date}${parts.join(t('common.listSeparator'))}`;
});
</script>

<style scoped lang="scss">
.item-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  box-shadow: var(--card-shadow);
}

.item-panel__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-panel__title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-panel__title h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 19px;
  font-weight: 600;
}

.item-panel__targets {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
}

.item-panel__label {
  margin-right: 6px;
  color: var(--text-secondary);
}

.item-panel__last {
  margin: 0;
  padding: 8px 10px;
  color: var(--primary-color);
  background: var(--primary-light);
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
}

.item-panel__hint {
  margin: 0;
  color: var(--warning-color);
  font-size: 13px;
  text-align: left;
}

.item-panel__metrics {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
}

.metric-row__label {
  flex: none;
  color: var(--text-secondary);
  font-size: 15px;
}

.metric-row__control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-row__unit {
  color: var(--text-secondary);
  font-size: 13px;
}

.duration-input {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.duration-part {
  display: flex;
  align-items: center;
  gap: 4px;
}

.duration-part small {
  color: var(--text-secondary);
  font-size: 12px;
}

.item-panel__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.status-button {
  height: 46px;
  font-size: 15px;
}

.item-panel__skip-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  color: var(--text-primary);
  background: var(--control-hover-bg);
  border: none;
  border-radius: 10px;
  font-size: 14px;
  text-align: left;
}

.item-panel__skip-trigger:active {
  opacity: 0.75;
}

.item-panel__skip-label {
  flex: none;
  color: var(--text-secondary);
}

.item-panel__skip-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-panel__note {
  padding: 10px 12px;
  background: var(--control-hover-bg);
  border-radius: 10px;
}

@media (max-width: 360px) {
  .metric-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
