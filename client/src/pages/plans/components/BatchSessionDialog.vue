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

      <div class="training-items-heading">
        <span>{{ t('plans.manager.trainingItems') }}</span>
        <el-button :icon="Plus" :disabled="!canAddBatchSessionExercise" @click="addBatchSessionItem">
          {{ t('plans.manager.addTrainingItem') }}
        </el-button>
      </div>
      <div class="session-items-table-wrap">
        <el-table :data="batchSessionItems" border class="session-items-table">
          <el-table-column :label="t('plans.manager.trainingItems')" min-width="220">
            <template #default="{ row: item }">
              <el-select
                v-model="item.exerciseId"
                class="exercise-select"
                filterable
                :placeholder="t('plans.manager.selectExercise')"
                @change="resetItemTargets(item)"
              >
                <el-option
                  v-for="exercise in optionsFor(batchSessionItems, item)"
                  :key="exercise.id"
                  :label="exercise.name"
                  :value="exercise.id"
                  :disabled="!exercise.enabled"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column :label="t('plans.manager.targets')" min-width="460">
            <template #default="{ row: item }">
              <TrainingItemTargets
                :item="item"
                :exercise="exerciseFor(item.exerciseId)"
                grid-class="session-target-grid"
                @update="applyTargetUpdate(item, $event)"
              />
            </template>
          </el-table-column>
          <el-table-column :label="t('plans.sessions.actions')" width="72" align="center">
            <template #default="{ $index }">
              <el-tooltip :content="t('common.delete')" placement="top">
                <el-button
                  link
                  type="danger"
                  :icon="Delete"
                  :aria-label="t('common.delete')"
                  @click="removeBatchSessionItem($index)"
                />
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>

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
import { computed, reactive, ref, toRef, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Delete, Plus } from '@element-plus/icons-vue';
import TrainingItemTargets from '@/pages/plans/components/TrainingItemTargets.vue';
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
const { applyTargetUpdate, canAddItem, createNextItem, exerciseFor, optionsFor, resetItemTargets, targetPayload } =
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

const canAddBatchSessionExercise = computed(() => canAddItem(batchSessionItems.value));
const batchSessionDates = computed(() =>
  getBatchDates(batchSessionForm.dates, batchSessionForm.frequency, batchSessionForm.weekdays, chinaCalendar.value)
);

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
  addBatchSessionItem();
}

function addBatchSessionItem() {
  const item = createNextItem(batchSessionItems.value);
  if (item) batchSessionItems.value.push(item);
}

function removeBatchSessionItem(index) {
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
function submitBatchSessions() {
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

  emit('submit', {
    dates: batchSessionDates.value,
    notes: batchSessionForm.notes,
    status: batchSessionForm.status,
    items: batchSessionItems.value.map((item) => ({ exerciseId: item.exerciseId, targets: targetPayload(item) }))
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

.session-items-table-wrap {
  margin-bottom: 18px;
  overflow-x: auto;
}

.session-items-table {
  min-width: 752px;
}

.session-items-table :deep(.el-table__cell) {
  padding: 8px 0;
}

.session-items-table :deep(th.el-table__cell) {
  color: var(--text-secondary);
  background: var(--app-bg);
  font-weight: 600;
}

.session-items-table :deep(.cell) {
  padding: 0 12px;
}

@media (max-width: 640px) {
  .batch-session-fields {
    grid-template-columns: 1fr !important;
  }
}
</style>
