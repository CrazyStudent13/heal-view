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

      <div v-if="loading" class="chart-panel__state chart-panel__state--loading">
        <p>{{ loadingText }}</p>
      </div>

      <div v-else-if="empty" class="chart-panel__state chart-panel__state--empty">
        <el-empty :description="emptyDescription" :image-size="emptyImageSize" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  empty: {
    type: Boolean,
    default: false
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
  panelClass: {
    type: [String, Array, Object],
    default: ''
  }
});
</script>
