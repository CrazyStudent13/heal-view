<template>
  <div class="training-duration-input">
    <template v-for="part in visibleParts" :key="part">
      <div class="training-duration-input__part">
        <el-input-number
          :model-value="displayParts[part]"
          :min="0"
          :max="part === 'hours' ? 99 : part === 'minutes' && minutesOnly ? Math.max(59, displayParts.minutes) : 59"
          :precision="0"
          :aria-label="`${t('plans.exercise.metricOptions.duration')} ${partLabel(part)}`"
          controls-position="right"
          @update:model-value="updatePart(part, $event)"
        />
        <small>{{ partLabel(part) }}</small>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  modelValue: { type: Object, required: true },
  minutesOnly: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);
const { t } = useLocaleStore();
const displayParts = computed(() =>
  props.minutesOnly
    ? {
        hours: 0,
        minutes: (props.modelValue.hours || 0) * 60 + (props.modelValue.minutes || 0),
        seconds: props.modelValue.seconds || 0
      }
    : props.modelValue
);
const visibleParts = computed(() => (props.minutesOnly ? ['minutes', 'seconds'] : ['hours', 'minutes', 'seconds']));
const partLabel = (part) => t(`plans.manager.units.durationParts.${part}`);

function updatePart(part, value) {
  emit('update:modelValue', { ...displayParts.value, [part]: value ?? 0 });
}
</script>

<style scoped>
.training-duration-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
}
.training-duration-input__part {
  display: flex;
  align-items: center;
  gap: 6px;
}
.training-duration-input__part :deep(.el-input-number) {
  width: 96px;
  min-width: 96px;
  flex: none;
}
.training-duration-input__part small {
  color: var(--text-secondary);
}
</style>
