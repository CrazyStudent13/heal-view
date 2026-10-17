<template>
  <el-dialog
    :model-value="modelValue"
    class="session-dialog batch-session-dialog"
    :title="t('plans.manager.batchTitle')"
    width="min(900px, calc(100vw - 32px))"
    top="5vh"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="batch-session-dialog__description">{{ t('plans.manager.batchDescription') }}</p>
    <el-form label-position="top" @submit.prevent>
      <div class="batch-session-fields">
        <el-form-item :label="t('plans.manager.dateRange')" required>
          <el-date-picker
            v-model="batchSessionForm.dates"
            class="full-width"
            type="daterange"
            value-format="YYYY-MM-DD"
            :disabled-date="batchSessionDateDisabled"
          />
        </el-form-item>
        <el-form-item :label="t('plans.manager.status')">
          <el-select v-model="batchSessionForm.status" class="full-width">
            <el-option v-for="status in sessionStatuses" :key="status" :label="statusLabel(status)" :value="status" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <span class="batch-frequency-label">
              <span>{{ t('plans.manager.batchFrequency') }}</span>
              <span class="batch-frequency-count">
                {{ t('plans.manager.batchPreview', { count: batchSessionDates.length }) }}
              </span>
            </span>
          </template>
          <el-select v-model="batchSessionForm.frequency" class="full-width">
            <el-option
              v-for="frequency in batchFrequencies"
              :key="frequency"
              :label="t(`plans.manager.batchFrequencies.${frequency}`)"
              :value="frequency"
            />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item v-if="batchSessionForm.frequency === 'weekdays'" :label="t('plans.manager.batchWeekdays')">
        <el-checkbox-group v-model="batchSessionForm.weekdays" class="weekday-options">
          <el-checkbox v-for="day in weekdayOptions" :key="day.value" :label="day.value">
            {{ day.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <p v-if="batchSessionForm.frequency === 'china_workdays' && chinaCalendarLoading" class="calendar-notice">
        {{ t('plans.manager.chinaCalendarLoading') }}
      </p>
      <p
        v-else-if="batchSessionForm.frequency === 'china_workdays' && chinaCalendarUnavailableYears.length"
        class="calendar-notice calendar-notice--warning"
      >
        {{ t('plans.manager.chinaCalendarUnavailable', { years: unavailableYearsText() }) }}
      </p>

      <TrainingItemCards
        v-model:expanded="expandedBatchSessionItems"
        :items="batchSessionItems"
        :exercises="exercises"
        @add="addBatchSessionItem"
        @remove="removeBatchSessionItem"
        @update-target="applyItemTargetUpdate"
        @change-exercise="applyItemExerciseChange"
      />

      <el-form-item :label="t('plans.manager.sessionNotes')">
        <el-input v-model="batchSessionForm.notes" type="textarea" :rows="3" maxlength="2000" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="saving" @click="submitBatchSessions">
        {{ t('plans.manager.generateSessions') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, h, reactive, ref, toRef, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import TrainingItemCards from '@/pages/plans/components/TrainingItemCards.vue';
import { BATCH_FREQUENCIES, getBatchDates, useChinaCalendar } from '@/pages/plans/composables/useChinaCalendar.js';
import { SESSION_STATUSES, usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { useTrainingItemEditor } from '@/pages/plans/composables/useTrainingItemEditor.js';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 要补训练课的计划；日期区间决定哪几天可选。 */
  plan: { type: Object, default: null },
  exercises: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'submit']);

const { t } = useLocaleStore();
const { statusLabel, weekdayOptions } = usePlanLabels();
const { applyTargetUpdate, createNextItem, exerciseFor, hasCompleteTargets, resetItemTargets, targetPayload } =
  useTrainingItemEditor(toRef(props, 'exercises'));
const { chinaCalendar, chinaCalendarUnavailableYears, chinaCalendarLoading, loadChinaCalendar, unavailableYearsText } =
  useChinaCalendar();

const sessionStatuses = SESSION_STATUSES;
const batchFrequencies = BATCH_FREQUENCIES;
const batchSessionForm = reactive({
  dates: [],
  frequency: 'china_workdays',
  weekdays: [1, 2, 3, 4, 5],
  status: 'planned',
  notes: ''
});
const batchSessionItems = ref([]);
const expandedBatchSessionItems = ref([]);

const batchSessionDates = computed(() =>
  getBatchDates(batchSessionForm.dates, batchSessionForm.frequency, batchSessionForm.weekdays, chinaCalendar.value)
);

/**
 * 所选日期里已经存在、且本次模板又要再加一遍的训练项目。
 * 按项目聚合日期，确认弹窗里才能一句话说清「哪个动作在哪些天重复」。
 */
const duplicateGroups = computed(() => {
  const sessionsByDate = new Map((props.plan?.sessions || []).map((session) => [session.scheduledDate, session]));
  const groups = new Map();
  for (const date of batchSessionDates.value) {
    const existingItems = sessionsByDate.get(date)?.items || [];
    if (existingItems.length === 0) continue;
    const existingExerciseIds = new Set(existingItems.map((item) => item.exerciseId));
    for (const item of batchSessionItems.value) {
      if (!item.exerciseId || !existingExerciseIds.has(item.exerciseId)) continue;
      const dates = groups.get(item.exerciseId) || [];
      dates.push(date);
      groups.set(item.exerciseId, dates);
    }
  }
  return Array.from(groups, ([exerciseId, dates]) => ({
    name: exerciseFor(exerciseId)?.name || String(exerciseId),
    dates
  }));
});

function formatDuplicateDates(dates) {
  const separator = t('common.listSeparator');
  const head = dates.slice(0, 3).join(separator);
  return dates.length > 3 ? t('plans.manager.duplicateDatesMore', { dates: head, count: dates.length - 3 }) : head;
}

/** 有重复项目时先问一句：覆盖这些已有项目的目标，还是放弃本次生成。 */
async function confirmDuplicateOverwrite() {
  if (duplicateGroups.value.length === 0) return true;
  const message = h('div', [
    h('p', t('plans.manager.duplicateIntro')),
    h(
      'ul',
      duplicateGroups.value.map((group) => h('li', `${group.name}：${formatDuplicateDates(group.dates)}`))
    ),
    h('p', t('plans.manager.duplicateOverwriteHint'))
  ]);
  try {
    await ElMessageBox.confirm(message, t('plans.manager.duplicateTitle'), {
      confirmButtonText: t('plans.manager.overwriteExisting'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    });
    return true;
  } catch {
    return false;
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) initializeForm();
  },
  { immediate: true }
);

watch(
  () => batchSessionForm.dates.slice(),
  (dates) => {
    if (props.modelValue && dates.length === 2) loadChinaCalendar(dates);
  }
);

function initializeForm() {
  Object.assign(batchSessionForm, {
    dates: props.plan ? [props.plan.startDate, props.plan.endDate] : [],
    frequency: 'china_workdays',
    weekdays: [1, 2, 3, 4, 5],
    status: 'planned',
    notes: ''
  });
  batchSessionItems.value = [];
  expandedBatchSessionItems.value = [];
  addBatchSessionItem();
}

function addBatchSessionItem() {
  const item = createNextItem(batchSessionItems.value);
  if (!item) return;
  batchSessionItems.value.push(item);
  // 新加的条目直接展开，省掉一次多余点击（与训练课弹窗一致）。
  expandedBatchSessionItems.value.push(item.key);
}

/** 换动作后必须重算目标：旧动作的指标对新动作大多不成立。重选同一个动作不动已填的目标。 */
function applyItemExerciseChange({ item, exerciseId }) {
  if (item.exerciseId === exerciseId) return;
  item.exerciseId = exerciseId;
  resetItemTargets(item);
}

function applyItemTargetUpdate({ item, patch }) {
  applyTargetUpdate(item, patch);
}

function removeBatchSessionItem(index) {
  // 批量生成是「同一套训练内容复制到多天」，删空就没有可生成的模板了。
  if (batchSessionItems.value.length <= 1) {
    return ElMessage.warning(t('plans.manager.minimumOneTrainingItem'));
  }
  expandedBatchSessionItems.value = expandedBatchSessionItems.value.filter(
    (key) => key !== batchSessionItems.value[index].key
  );
  batchSessionItems.value.splice(index, 1);
}

function batchSessionDateDisabled(date) {
  const plan = props.plan;
  if (!plan) return true;
  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  return dateKey < plan.startDate || dateKey > plan.endDate;
}

/** 校验通过后交给页面发请求：弹窗只负责把「补哪些天、补什么」讲清楚。 */
async function submitBatchSessions() {
  if (batchSessionForm.dates.length !== 2) return ElMessage.warning(t('plans.manager.datesRequired'));
  if (batchSessionForm.frequency === 'china_workdays' && chinaCalendarLoading.value) {
    return ElMessage.warning(t('plans.manager.chinaCalendarLoading'));
  }
  if (batchSessionForm.frequency === 'weekdays' && batchSessionForm.weekdays.length === 0) {
    return ElMessage.warning(t('plans.manager.batchWeekdaysRequired'));
  }
  if (batchSessionForm.frequency === 'china_workdays' && chinaCalendarUnavailableYears.value.length > 0) {
    return ElMessage.warning(t('plans.manager.chinaCalendarUnavailable', { years: unavailableYearsText() }));
  }
  if (batchSessionItems.value.length === 0) return ElMessage.warning(t('plans.manager.itemsRequired'));
  if (batchSessionItems.value.some((item) => !item.exerciseId)) {
    return ElMessage.warning(t('plans.manager.exerciseRequired'));
  }
  if (batchSessionDates.value.length === 0) return ElMessage.warning(t('plans.manager.batchNoDates'));

  // 生成出来的每一节课都带同一套训练内容，目标填不全后续就没法计算完成度。
  const itemsWithoutTargets = batchSessionItems.value.filter((item) => !hasCompleteTargets(item));
  if (itemsWithoutTargets.length > 0) {
    expandedBatchSessionItems.value = [
      ...new Set([...expandedBatchSessionItems.value, ...itemsWithoutTargets.map((item) => item.key)])
    ];
    return ElMessage.warning(t('plans.manager.targetRequired', { count: itemsWithoutTargets.length }));
  }

  // 这些日期上已有同一动作时，问清楚是覆盖目标还是放弃，别静默跳过。
  if (!(await confirmDuplicateOverwrite())) return;

  emit('submit', {
    dates: batchSessionDates.value,
    notes: batchSessionForm.notes,
    status: batchSessionForm.status,
    items: batchSessionItems.value.map((item) => ({ exerciseId: item.exerciseId, targets: targetPayload(item) })),
    overwriteExistingItems: duplicateGroups.value.length > 0
  });
}
</script>

<style scoped lang="scss">
@use '../styles/dialogShared';
@use '../styles/itemForm';
@use '../styles/sessionDialogScroll';

.batch-session-dialog__description {
  margin: 0 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.batch-session-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.batch-session-fields .el-form-item {
  min-width: 0;
}

.batch-frequency-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.batch-frequency-count {
  color: var(--primary-color);
  font-size: 12px;
  font-weight: 500;
}

@media (max-width: 640px) {
  .batch-session-fields {
    grid-template-columns: 1fr !important;
  }
}
</style>
