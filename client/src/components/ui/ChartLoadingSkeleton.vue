<template>
  <div class="chart-loading-skeleton" :style="gridStyle">
    <div class="chart-loading-skeleton__stats">
      <div class="chart-loading-skeleton__title" :style="{ width: titleWidth }"></div>
      <div class="chart-loading-skeleton__cards">
        <div v-for="i in statCount" :key="i" class="chart-loading-skeleton__card">
          <div class="chart-loading-skeleton__icon"></div>
          <div class="chart-loading-skeleton__content">
            <div class="chart-loading-skeleton__header">
              <div class="chart-loading-skeleton__label"></div>
              <div v-if="showHelpIcon" class="chart-loading-skeleton__help"></div>
            </div>
            <div class="chart-loading-skeleton__value"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showChart" class="chart-loading-skeleton__chart">
      <div class="chart-loading-skeleton__title chart-loading-skeleton__title--small" :style="{ width: chartTitleWidth }"></div>
      <div class="chart-loading-skeleton__area" :style="{ minHeight: chartMinHeight }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  statCount: {
    type: Number,
    default: 6
  },
  statColumns: {
    type: Number,
    default: 3
  },
  titleWidth: {
    type: String,
    default: '120px'
  },
  chartTitleWidth: {
    type: String,
    default: '140px'
  },
  chartMinHeight: {
    type: String,
    default: '280px'
  },
  showChart: {
    type: Boolean,
    default: true
  },
  showHelpIcon: {
    type: Boolean,
    default: true
  }
});

const gridStyle = computed(() => ({
  '--stat-columns': props.statColumns
}));
</script>
