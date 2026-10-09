<template>
  <article class="item-panel" :class="{ 'item-panel--card': separateCard }">
    <header class="item-panel__header">
      <div class="item-panel__title">
        <h3>{{ item.exercise.name }}</h3>
        <van-tag :type="statusType" size="medium">{{ statusLabel }}</van-tag>
      </div>
      <p class="item-panel__targets">
        <span class="item-panel__label">{{ t('mobile.targets') }}</span>
        {{ targetsText }}
      </p>
    </header>

    <p v-if="lastAttemptText" class="item-panel__last">{{ t('mobile.lastAttempt', { text: lastAttemptText }) }}</p>

    <section class="item-panel__details" :class="{ 'item-panel__details--open': detailsOpen }">
      <button
        type="button"
        class="item-panel__details-toggle"
        :aria-expanded="detailsOpen"
        @click="$emit('toggle-details')"
      >
        <span>{{ detailsOpen ? t('mobile.hideDetails') : t('mobile.recordDetails') }}</span>
        <van-icon :name="detailsOpen ? 'arrow-up' : 'arrow-down'" />
      </button>

      <div v-if="detailsOpen" class="item-panel__details-body">
        <div class="item-panel__metrics">
          <!-- 组数单独作为完成度呈现：分母是目标组数，分子是实际做了几组 -->
          <van-cell
            v-if="targetSets > 0 && usesSetsPicker"
            class="sets-picker-cell"
            :title="t('mobile.completedSets')"
            :value="setsProgressText"
            is-link
            clickable
            @click="openSetsPicker"
          />

          <div v-else-if="targetSets > 0" class="metric-row">
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
            <div class="metric-row__control">
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

        <button v-if="hasDuration" type="button" class="item-panel__timer-trigger" @click="openTimer">
          <van-icon name="clock-o" />
          <span>{{ t('mobile.startTimer') }}</span>
          <small>{{ t('mobile.timerReady', { seconds: readyDuration }) }}</small>
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
      </div>
    </section>

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
        :type="isMarkedSkipped ? 'warning' : 'default'"
        icon="arrow"
        block
        @click="openSkipReason"
      >
        {{ t('mobile.itemSkipped') }}
      </van-button>
    </div>

    <van-popup v-model:show="skipReasonVisible" position="center" round :style="{ width: 'min(88vw, 360px)' }">
      <div class="skip-dialog">
        <h3 class="skip-dialog__title">{{ t('mobile.skipReasonLabel') }}</h3>
        <p class="skip-dialog__exercise">{{ item.exercise.name }}</p>
        <van-radio-group v-model="skipReasonDraft" class="skip-dialog__options">
          <van-radio v-for="reason in skipReasonOptions" :key="reason" :name="reason">
            {{ t(`mobile.skipReasons.${reason}`) }}
          </van-radio>
        </van-radio-group>
        <van-field
          v-if="skipReasonDraft === 'other'"
          v-model="skipReasonNote"
          type="textarea"
          rows="2"
          autosize
          maxlength="200"
          :label="t('mobile.skipReasonLabel')"
          :placeholder="t('mobile.skipReasonPlaceholder')"
        />
        <div class="skip-dialog__actions">
          <van-button type="primary" block @click="confirmSkip">{{ t('mobile.itemSkipped') }}</van-button>
          <van-button plain block @click="skipReasonVisible = false">{{ t('common.cancel') }}</van-button>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="timerVisible" position="center" round :style="{ width: 'min(88vw, 360px)' }">
      <div class="timer-dialog">
        <p class="timer-dialog__title">{{ item.exercise.name }}</p>
        <div v-if="!timerRunning && !timerFinished" class="timer-dialog__setting">
          <span class="timer-dialog__setting-label">{{ metricLabel('duration') }}</span>
          <div class="duration-input">
            <div v-for="part in durationPartsList" :key="part" class="duration-part">
              <van-stepper
                :model-value="durationParts[part]"
                :min="0"
                :max="part === 'minutes' ? 99 : 59"
                integer
                button-size="32px"
                :aria-label="durationPartLabel(part)"
                @update:model-value="(value) => updateDurationPart(part, value)"
              />
              <small>{{ durationPartLabel(part) }}</small>
            </div>
          </div>
        </div>
        <div class="timer-dialog__face" :class="{ 'timer-dialog__face--running': timerRunning }">
          <span>{{ formatTimer(timerRemaining) }}</span>
        </div>
        <p class="timer-dialog__status">{{ timerStatus }}</p>
        <div class="timer-dialog__actions">
          <van-button v-if="!timerRunning && !timerFinished" type="primary" block @click="startTimer">
            {{ t('mobile.startTimer') }}
          </van-button>
          <van-button v-if="timerRunning" type="danger" plain block @click="stopTimer">
            {{ t('mobile.stopTimer') }}
          </van-button>
          <van-button v-if="timerFinished" type="primary" block @click="closeTimer">
            {{ t('mobile.timerDone') }}
          </van-button>
          <van-button v-if="!timerRunning && !timerFinished" plain block @click="closeTimer">
            {{ t('common.cancel') }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="setsPickerVisible" position="bottom" round>
      <van-picker
        :columns="setsPickerOptions"
        :model-value="[completedSets]"
        @confirm="confirmSetsPicker"
        @cancel="setsPickerVisible = false"
      />
    </van-popup>
  </article>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { showToast } from 'vant';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  item: { type: Object, required: true },
  actuals: { type: Object, default: () => ({}) },
  skipReason: { type: String, default: '' },
  note: { type: String, default: '' },
  detailsOpen: { type: Boolean, default: false },
  separateCard: { type: Boolean, default: false }
});

const emit = defineEmits(['update', 'set-complete', 'toggle-details']);

const { t } = useLocaleStore();

// 移动端训练时长按分钟和秒录入，小时级时长不属于日常打卡场景。
const durationPartsList = ['minutes', 'seconds'];
// 重量按 0.5 递增最贴近器械配重片，其余计数类指标按 1 递增。
const METRIC_STEPS = { weight: 0.5 };
const HALF_STEP_METRICS = new Set(['weight']);

const durationParts = ref({ minutes: 0, seconds: 0 });
const skipReasonOptions = ['equipment_busy', 'no_time', 'discomfort', 'too_hard', 'other'];
const skipReasonVisible = ref(false);
const skipReasonDraft = ref('');
const skipReasonNote = ref('');
const timerVisible = ref(false);
const timerRunning = ref(false);
const timerFinished = ref(false);
const timerRemaining = ref(0);
const timerEndAt = ref(null);
const setsPickerVisible = ref(false);
let timerHandle = null;

const targets = computed(() => {
  // 组数在「已完成组数」里单独呈现，不再作为普通指标重复出现。
  const target = props.item.targets || {};
  const keys = Object.keys(target).filter(
    (metric) => metric !== 'duration' && metric !== 'durationSeconds' && metric !== 'sets'
  );
  // 只显示这个运动项目真正支持的指标，避免历史遗留下来的无效目标继续显示。
  const supported = new Set(props.item.exercise?.metrics || []);
  const visible = keys.filter((metric) => supported.has(metric));
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
const usesSetsPicker = computed(() => ['大腿内外侧肌训练器', '平板支撑'].includes(props.item.exercise?.name));
const setsProgressText = computed(() =>
  t('mobile.setsProgress', { done: completedSets.value, target: targetSets.value })
);
const setsPickerOptions = computed(() =>
  Array.from({ length: targetSets.value + 1 }, (_, value) => ({
    text: `${value}${unitLabel('sets')}`,
    value
  }))
);

// 完成度完全由组数决定，面板上的按钮高亮也读同一个值，避免两处状态各说各话。
const isComplete = computed(() =>
  targetSets.value > 0 ? completedSets.value >= targetSets.value : completedSets.value > 0
);
const isMarkedSkipped = computed(() => completedSets.value === 0 && Boolean(props.skipReason));
const hasDuration = computed(() => {
  const metrics = new Set(props.item.exercise?.metrics || []);
  return metrics.has('duration') || metrics.has('durationSeconds') || targetDurationSeconds() > 0;
});
const timerDuration = ref(0);
const readyDuration = computed(() => timerDuration.value || resolveDurationSeconds() || 60);
const timerStatus = computed(() => {
  if (timerFinished.value) return t('mobile.timerFinished');
  if (timerRunning.value) return t('mobile.timerRunning');
  return t('mobile.timerReady', { seconds: readyDuration.value });
});
const statusLabel = computed(() => {
  if (isComplete.value) return t('mobile.itemStatusLogged');
  if (completedSets.value > 0) return t('mobile.itemStatusPartial');
  if (isMarkedSkipped.value) return t('mobile.itemStatusSkipped');
  return t('mobile.statusPending');
});
const statusType = computed(() => {
  if (isComplete.value) return 'success';
  if (completedSets.value > 0) return 'warning';
  if (isMarkedSkipped.value) return 'warning';
  return 'default';
});

function updateCompletedSets(value) {
  const next = Math.max(0, Math.round(Number(value) || 0));
  emit('update', { actuals: { ...props.actuals, sets: next > 0 ? next : null } });
}

function openSetsPicker() {
  setsPickerVisible.value = true;
}

function confirmSetsPicker({ selectedValues }) {
  updateCompletedSets(selectedValues?.[0] ?? 0);
  setsPickerVisible.value = false;
}

// 已记录的时长优先，其次沿用目标时长，最后从上次成绩预填。
watch(
  () => [props.item, props.actuals],
  () => {
    const seconds = resolveDurationSeconds();
    durationParts.value = {
      minutes: Math.floor(seconds / 60),
      seconds: seconds % 60
    };
  },
  { immediate: true, deep: true }
);

function openTimer() {
  if (!hasDuration.value) return;
  stopTimer();
  timerDuration.value = resolveDurationSeconds() || 60;
  durationParts.value = {
    minutes: Math.floor(timerDuration.value / 60),
    seconds: timerDuration.value % 60
  };
  timerRemaining.value = timerDuration.value;
  timerRunning.value = false;
  timerFinished.value = false;
  timerVisible.value = true;
}

function startTimer() {
  if (timerRunning.value) return;
  if (timerRemaining.value <= 0) {
    timerDuration.value = readyDuration.value;
    timerRemaining.value = timerDuration.value;
  }
  timerEndAt.value = Date.now() + timerRemaining.value * 1000;
  timerRunning.value = true;
  syncTimer();
  timerHandle = window.setInterval(syncTimer, 250);
}

// The interval keeps the display reactive while the end timestamp keeps it accurate after backgrounding.
function syncTimer() {
  if (!timerEndAt.value || timerFinished.value) return;
  timerRemaining.value = Math.max(0, Math.ceil((timerEndAt.value - Date.now()) / 1000));
  if (timerRemaining.value === 0) finishTimer();
}

function stopTimer() {
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = null;
  timerEndAt.value = null;
  timerRunning.value = false;
}

function finishTimer() {
  stopTimer();
  timerFinished.value = true;
  emit('update', {
    actuals: {
      ...props.actuals,
      durationSeconds: timerDuration.value || readyDuration.value,
      sets: Math.min(targetSets.value || Number.MAX_SAFE_INTEGER, completedSets.value + 1)
    }
  });
}

function closeTimer() {
  stopTimer();
  timerVisible.value = false;
}

function openSkipReason() {
  const existing = props.skipReason?.trim() || '';
  skipReasonDraft.value = skipReasonOptions.includes(existing) ? existing : existing ? 'other' : '';
  skipReasonNote.value = existing && !skipReasonOptions.includes(existing) ? existing : '';
  skipReasonVisible.value = true;
}

function confirmSkip() {
  if (!skipReasonDraft.value) {
    showToast(t('mobile.chooseReason'));
    return;
  }
  const reason = skipReasonDraft.value === 'other' ? skipReasonNote.value.trim() || 'other' : skipReasonDraft.value;
  emit('set-complete', { complete: false, skipReason: reason });
  skipReasonVisible.value = false;
}

onBeforeUnmount(stopTimer);

function formatTimer(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
  timerDuration.value = next.minutes * 60 + next.seconds;
  if (timerVisible.value && !timerRunning.value && !timerFinished.value) {
    timerRemaining.value = timerDuration.value;
  }
  emit('update', {
    actuals: { ...props.actuals, durationSeconds: next.minutes * 60 + next.seconds }
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
  const minutes = Math.floor(total / 60);
  const secondsPart = total % 60;
  const parts = [];
  if (minutes > 0) parts.push(`${minutes}${durationPartLabel('minutes')}`);
  if (secondsPart > 0 || parts.length === 0) parts.push(`${secondsPart}${durationPartLabel('seconds')}`);
  return parts.join('');
}

const targetsText = computed(() => {
  const target = props.item.targets || {};
  const parts = [];
  const seconds = targetDurationSeconds();
  if (seconds > 0) {
    const duration = formatDuration(seconds);
    parts.push(targetSets.value > 0 ? `${duration} × ${targetSets.value}${unitLabel('sets')}` : duration);
  }
  for (const [metric, value] of Object.entries(target)) {
    // 组数由完成度控件承载，这里不再重复；时长已折算成秒单独呈现。
    if (metric === 'duration' || metric === 'durationSeconds' || metric === 'sets') continue;
    parts.push(`${metricLabel(metric)} ${value}${unitLabel(metric)}`);
  }
  if (targetSets.value > 0 && seconds <= 0) {
    parts.push(`${metricLabel('sets')} ${targetSets.value}${unitLabel('sets')}`);
  }
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
  min-width: 0;
  padding: 14px 0;
  background: transparent;
}

.item-panel--card {
  margin: 0;
  padding: 14px 12px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
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
  justify-content: flex-start;
  width: 100%;
  gap: 8px;
  min-width: 0;
  text-align: left;
}

.item-panel__title h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
  text-align: left;
}

.item-panel__title :deep(.van-tag) {
  flex: none;
}

.item-panel__targets {
  overflow-wrap: anywhere;
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

.item-panel__details {
  min-width: 0;
}

.item-panel__details-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 40px;
  padding: 0 2px;
  color: var(--primary-color);
  background: transparent;
  border: 0;
  border-radius: 0;
  font-size: 13px;
  text-align: left;
}

.item-panel__details-toggle:active {
  opacity: 0.75;
}

.item-panel__timer-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 10px;
  color: var(--primary-color);
  background: var(--primary-light);
  border: 1px solid var(--primary-color);
  border-radius: 8px;
  font-size: 14px;
  text-align: left;
}

.item-panel__timer-trigger small {
  flex: 1;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: right;
}

.item-panel__timer-trigger:active {
  opacity: 0.78;
}

.item-panel__metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
}

.item-panel__details-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--card-border);
}

.metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
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

.sets-picker-cell {
  margin: 0 -4px;
  padding: 10px 4px;
  background: transparent;
  border-radius: 8px;
}

.sets-picker-cell :deep(.van-cell__title) {
  flex: 1;
  color: var(--text-secondary);
  font-size: 15px;
  text-align: left;
}

.sets-picker-cell :deep(.van-cell__value) {
  flex: none;
  color: var(--text-primary);
  font-size: 15px;
  text-align: right;
}

.duration-input {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
}

.duration-part {
  display: flex;
  align-items: center;
  flex: none;
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

.item-panel__note {
  padding: 10px 12px;
  background: var(--control-hover-bg);
  border-radius: 8px;
}

.skip-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: var(--card-bg);
}

.skip-dialog__title {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 600;
}

.skip-dialog__exercise {
  margin: -6px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.skip-dialog__options {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skip-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timer-dialog {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 16px;
  padding: 24px 20px calc(20px + env(safe-area-inset-bottom));
  background: var(--card-bg);
}

.timer-dialog__title {
  margin: 0;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 600;
}

.timer-dialog__setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
}

.timer-dialog__setting .duration-input {
  min-width: 0;
  justify-content: flex-end;
}

.timer-dialog__setting-label {
  flex: none;
  color: var(--text-secondary);
  font-size: 14px;
}

.timer-dialog__face {
  display: grid;
  place-items: center;
  width: 176px;
  height: 176px;
  color: var(--text-primary);
  background: var(--app-bg);
  border: 8px solid var(--card-border);
  border-radius: 50%;
  font-size: 36px;
  font-variant-numeric: tabular-nums;
  transition:
    border-color 160ms ease,
    color 160ms ease;
}

.timer-dialog__face--running {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.timer-dialog__status {
  min-height: 20px;
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.timer-dialog__actions {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 10px;
}

@media (max-width: 360px) {
  .metric-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
</style>
