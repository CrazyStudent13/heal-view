<template>
  <section class="batch-rule">
    <header class="batch-rule__header">
      <div>
        <h3>{{ t('plans.manager.batchTitle') }}</h3>
        <p>{{ t('plans.manager.batchDescription') }}</p>
      </div>
      <el-tag type="info" effect="plain">{{ t('plans.manager.batchHint') }}</el-tag>
    </header>

    <div class="batch-rule__controls">
      <el-form-item :label="t('plans.manager.batchFrequency')">
        <el-select v-model="batchRule.frequency" class="full-width">
          <el-option
            v-for="frequency in batchFrequencies"
            :key="frequency"
            :label="t(`plans.manager.batchFrequencies.${frequency}`)"
            :value="frequency"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="batchRule.frequency === 'weekdays'" :label="t('plans.manager.batchWeekdays')">
        <el-checkbox-group v-model="batchRule.weekdays" class="weekday-options">
          <el-checkbox v-for="day in weekdayOptions" :key="day.value" :label="day.value">
            {{ day.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </div>
    <p v-if="batchRule.frequency === 'china_workdays' && calendarLoading" class="calendar-notice">
      {{ t('plans.manager.chinaCalendarLoading') }}
    </p>
    <p
      v-else-if="batchRule.frequency === 'china_workdays' && calendarUnavailableYears.length"
      class="calendar-notice calendar-notice--warning"
    >
      {{
        t('plans.manager.chinaCalendarUnavailable', {
          years: calendarUnavailableYears.join(t('common.listSeparator'))
        })
      }}
    </p>

    <div class="training-items-heading batch-rule__items-heading">
      <span>{{ t('plans.manager.trainingItems') }}</span>
      <el-button :icon="Plus" :disabled="!canAddBatchExercise" @click="addBatchItem">
        {{ t('plans.manager.addTrainingItem') }}
      </el-button>
    </div>
    <div class="training-item-list batch-rule__items">
      <div v-for="(item, index) in batchItems" :key="item.key" class="training-item-editor">
        <div class="training-item-editor__row">
          <el-select
            v-model="item.exerciseId"
            class="exercise-select"
            filterable
            :placeholder="t('plans.manager.selectExercise')"
            @change="resetItemTargets(item)"
          >
            <el-option
              v-for="exercise in optionsFor(batchItems, item)"
              :key="exercise.id"
              :label="exercise.name"
              :value="exercise.id"
            />
          </el-select>
          <TrainingItemTargets
            :item="item"
            :exercise="exerciseFor(item.exerciseId)"
            @update="applyTargetUpdate(item, $event)"
          />
          <el-tooltip :content="t('common.delete')" placement="top">
            <el-button
              circle
              type="danger"
              plain
              :icon="Delete"
              :aria-label="t('common.delete')"
              @click="removeBatchItem(index)"
            />
          </el-tooltip>
        </div>
      </div>
    </div>

    <el-button
      type="primary"
      :icon="MagicStick"
      :disabled="batchItems.length === 0 || (batchRule.frequency === 'china_workdays' && calendarLoading)"
      @click="generateSessions"
    >
      {{ t('plans.manager.generateSessions') }}
    </el-button>
  </section>
</template>

<script setup>
import { computed, reactive, ref, toRef } from 'vue';
import { ElMessage } from 'element-plus';
import { Delete, MagicStick, Plus } from '@element-plus/icons-vue';
import TrainingItemTargets from '@/pages/plans/components/TrainingItemTargets.vue';
import { BATCH_FREQUENCIES, getBatchDates } from '@/pages/plans/composables/useChinaCalendar.js';
import { usePlanLabels } from '@/pages/plans/composables/usePlanLabels.js';
import { useTrainingItemEditor } from '@/pages/plans/composables/useTrainingItemEditor.js';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  exercises: { type: Array, default: () => [] },
  /** 计划日期区间，决定能生成哪些天。 */
  dateRange: { type: Array, default: () => [] },
  /** 中国工作日覆盖由计划弹窗持有，这里只读。 */
  chinaCalendar: { type: Map, default: () => new Map() },
  calendarUnavailableYears: { type: Array, default: () => [] },
  calendarLoading: { type: Boolean, default: false }
});
const emit = defineEmits(['generate']);

const { t } = useLocaleStore();
const { weekdayOptions } = usePlanLabels();
const { applyTargetUpdate, canAddItem, createNextItem, exerciseFor, optionsFor, resetItemTargets } =
  useTrainingItemEditor(toRef(props, 'exercises'));

const batchFrequencies = BATCH_FREQUENCIES;
const batchRule = reactive({ frequency: 'china_workdays', weekdays: [1, 2, 3, 4, 5] });
const batchItems = ref([]);

const canAddBatchExercise = computed(() => canAddItem(batchItems.value));

function addBatchItem() {
  const item = createNextItem(batchItems.value);
  if (item) batchItems.value.push(item);
}

function removeBatchItem(index) {
  batchItems.value.splice(index, 1);
}

/**
 * 只把「生成哪些天、每天放哪些项目」算出来交给计划弹窗：
 * 请假/加练都还要和已有的草稿训练课合并，合并规则属于计划弹窗的事。
 */
function generateSessions() {
  if (batchRule.frequency === 'weekdays' && batchRule.weekdays.length === 0) {
    return ElMessage.warning(t('plans.manager.batchWeekdaysRequired'));
  }
  if (batchRule.frequency === 'china_workdays' && props.calendarUnavailableYears.length > 0) {
    return ElMessage.warning(
      t('plans.manager.chinaCalendarUnavailable', {
        years: props.calendarUnavailableYears.join(t('common.listSeparator'))
      })
    );
  }
  emit('generate', {
    dates: getBatchDates(props.dateRange, batchRule.frequency, batchRule.weekdays, props.chinaCalendar),
    items: batchItems.value
  });
}
</script>

<style scoped lang="scss">
@use '../styles/dialogShared';
@use '../styles/itemForm';

.batch-rule {
  margin-bottom: 22px;
  padding: 14px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.batch-rule__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.batch-rule__header h3 {
  color: var(--text-primary);
  font-size: 15px;
  letter-spacing: 0;
}

.batch-rule__header p {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}

.batch-rule__controls {
  display: grid;
  grid-template-columns: minmax(180px, 0.7fr) minmax(300px, 1.3fr);
  gap: 16px;
}

.batch-rule__items-heading {
  margin-top: 2px;
}

.batch-rule__items {
  margin-bottom: 14px;
}

.training-item-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 18px;
}

.training-item-editor {
  padding: 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--app-bg);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.training-item-editor:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 14%, transparent);
}

.training-item-editor__row {
  display: grid;
  grid-template-columns: minmax(220px, 1.25fr) minmax(0, 2.4fr) auto;
  align-items: center;
  gap: 12px;
}

@media (max-width: 900px) {
  .training-item-editor__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}

@media (max-width: 640px) {
  .batch-rule__header {
    flex-direction: column;
  }

  .batch-rule__controls {
    grid-template-columns: 1fr !important;
  }
}
</style>
