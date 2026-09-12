<template>
  <div class="view-mode-tabs">
    <button
      type="button"
      :class="['tab-btn', { active: modelValue === 'single' }]"
      :aria-pressed="modelValue === 'single'"
      @click="$emit('update:modelValue', 'single')"
    >
      <span class="tab-icon">📅</span>
      <span class="tab-label">{{ t('nav.singleDayShort') }}</span>
    </button>
    <button
      type="button"
      :class="['tab-btn', { active: modelValue === 'compare' }]"
      :aria-pressed="modelValue === 'compare'"
      @click="$emit('update:modelValue', 'compare')"
    >
      <span class="tab-icon">📊</span>
      <span class="tab-label">{{ t('nav.multiDayShort') }}</span>
    </button>
  </div>
</template>

<script setup>
import { useLocaleStore } from '../../stores/localeStore';

const { t } = useLocaleStore();

defineProps({
  modelValue: {
    type: String,
    default: 'single',
    validator: (value) => ['single', 'compare'].includes(value)
  }
});

defineEmits(['update:modelValue']);
</script>

<style scoped lang="scss">
.view-mode-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--card-border);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--control-border);
  border-radius: 6px;
  background: var(--card-bg);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.tab-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.tab-btn.active {
  background: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
  font-weight: 500;
}

.tab-btn:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  white-space: nowrap;
}
</style>

