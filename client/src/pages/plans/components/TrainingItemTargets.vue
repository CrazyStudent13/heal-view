<template>
  <div v-if="metrics.length > 0" :class="containerClass">
    <component :is="entryTag" v-for="metric in metrics" :key="metric" :class="entryClass(metric)">
      <span :class="labelClass">{{ metricLabel(metric) }}</span>
      <TrainingDurationInput
        v-if="metric === 'duration'"
        :model-value="item.durationParts"
        :minutes-only="minutesOnly"
        @update:model-value="emitTarget('duration', $event)"
      />
      <div v-else-if="variant === 'card'" class="session-card-target__input">
        <el-input-number
          :model-value="item.targets?.[metric]"
          :aria-label="metricLabel(metric)"
          :min="0"
          :precision="metricPrecision(metric)"
          controls-position="right"
          @update:model-value="emitTarget(metric, $event)"
        />
        <small>{{ unitLabel(metric) }}</small>
      </div>
      <template v-else>
        <el-input-number
          :model-value="item.targets?.[metric]"
          :aria-label="metricLabel(metric)"
          :min="0"
          :precision="metricPrecision(metric)"
          controls-position="right"
          @update:model-value="emitTarget(metric, $event)"
        />
        <small>{{ unitLabel(metric) }}</small>
      </template>
    </component>
  </div>
  <p v-else class="no-targets">{{ t('plans.manager.noTargets') }}</p>
</template>

<script setup>
import { computed } from 'vue';
import TrainingDurationInput from '@/components/plans/TrainingDurationInput.vue';
import { useTrainingItemEditor } from '@/pages/plans/composables/useTrainingItemEditor.js';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  item: { type: Object, required: true },
  exercise: { type: Object, default: null },
  /** field：批量规则/批量加课的横向字段；card：训练课弹窗里的卡片字段。 */
  variant: { type: String, default: 'field' },
  gridClass: { type: String, default: '' }
});
const emit = defineEmits(['update']);

const { t } = useLocaleStore();
const { metricLabel, unitLabel, metricPrecision } = useTrainingItemEditor();

const metrics = computed(() => props.exercise?.metrics || []);
const minutesOnly = computed(() => props.exercise?.name === '平板支撑');
const entryTag = computed(() => (props.variant === 'card' ? 'div' : 'label'));
const labelClass = computed(() => (props.variant === 'card' ? 'session-card-target__label' : ''));
const containerClass = computed(() =>
  props.variant === 'card' ? 'session-card-targets' : ['target-grid', props.gridClass]
);

function entryClass(metric) {
  if (props.variant === 'card') {
    return ['session-card-target', { 'session-card-target--duration': metric === 'duration' }];
  }
  return ['target-field', { 'target-field--duration': metric === 'duration' }];
}

function emitTarget(metric, value) {
  emit('update', { metric, value });
}
</script>

<style scoped lang="scss">
.target-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px 12px;
  min-width: 0;
}

.session-target-grid {
  grid-template-columns: repeat(auto-fit, minmax(120px, max-content));
  justify-content: start;
}

.target-field {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.target-field > span,
.target-field small {
  flex: none;
}

.target-field--duration {
  grid-column: 1 / -1;
}

.target-field :deep(.el-input-number) {
  width: auto;
  min-width: 72px;
  flex: 1;
}

.session-target-grid .target-field:not(.target-field--duration) :deep(.el-input-number) {
  width: 88px;
  min-width: 88px;
  flex: none;
}

.target-field small {
  min-width: 0;
}

.no-targets {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.session-card-targets {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px 28px;
}

.session-card-target {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.session-card-target__label {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 20px;
}

.session-card-target__input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-card-target__input :deep(.el-input-number) {
  width: 120px;
}

.session-card-target__input small {
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .target-grid,
  .no-targets {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .target-grid {
    grid-template-columns: 1fr !important;
  }

  .session-card-targets {
    gap: 16px;
  }

  .session-card-target--duration {
    flex-basis: 100%;
  }
}
</style>
