<template>
  <div class="chart-panel" :class="panelClass">
    <div v-if="$slots.title" class="chart-panel__title">
      <slot name="title" />
    </div>

    <div v-if="$slots.metrics" class="chart-panel__metrics">
      <slot name="metrics" />
    </div>

    <div class="chart-panel__body">
      <slot />

      <AsyncState
        v-if="loading || error || empty"
        :loading="loading"
        :error="error"
        :empty="empty"
        :loading-text="loadingText"
        :empty-description="emptyDescription"
        :empty-image-size="emptyImageSize"
        :show-retry="showRetry"
        :retry-text="retryText"
        @retry="$emit('retry')"
      >
        <slot />
      </AsyncState>
    </div>
  </div>
</template>

<script setup>
import AsyncState from './AsyncState.vue';

defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  empty: {
    type: Boolean,
    default: false
  },
  error: {
    type: [String, Object, Error],
    default: null
  },
  emptyDescription: {
    type: String,
    default: ''
  },
  emptyImageSize: {
    type: Number,
    default: 120
  },
  loadingText: {
    type: String,
    default: ''
  },
  retryText: {
    type: String,
    default: ''
  },
  showRetry: {
    type: Boolean,
    default: false
  },
  panelClass: {
    type: [String, Array, Object],
    default: ''
  }
});

defineEmits(['retry']);
</script>

<style scoped lang="scss">
.chart-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.chart-panel__title,
.chart-panel__metrics {
  flex-shrink: 0;
}

.chart-panel__body {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.chart-panel__body :deep(.chart) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.chart-panel__body :deep(.async-state) {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--card-bg, #ffffff);
}
</style>
