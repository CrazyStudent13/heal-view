<template>
  <div class="chart-display">
    <!-- Single day mode: show different content based on chart type -->
    <template v-if="viewMode === 'single'">
      <!-- Default to sport records when no specific chart selected -->
      <DailySportChart v-if="chartType === 'sport' || chartType === 'steps'" />
      
      <!-- Show time series heart rate chart for single day mode -->
      <SingleDayHeartRateChart v-if="chartType === 'heartrate'" />
      
      <!-- Show other charts when explicitly selected (no calories in single mode) -->
      <StressChart v-if="chartType === 'stress' && hasData" :data="chartData" />
      <SleepTimelineChart v-if="chartType === 'sleep' && sleepTimelineData" :data="sleepTimelineData" />
      <SleepChart v-if="chartType === 'sleep' && !sleepTimelineData && hasData" :data="chartData" />
    </template>

    <!-- Multi-day comparison mode: show traditional charts -->
    <template v-else-if="viewMode === 'compare'">
      <StepsChart v-if="chartType === 'steps'" :data="chartData" :loading="loading" />
      <CaloriesChart v-if="chartType === 'calories' && hasData" :data="chartData" />
      <HeartRateChart v-if="chartType === 'heartrate' && hasData" :data="chartData" />
      <StressChart v-if="chartType === 'stress' && hasData" :data="chartData" />
      <SleepChart v-if="chartType === 'sleep' && hasData" :data="chartData" />
      <WeightChart v-if="chartType === 'weight'" :weight-data="weightData" :loading="loading" />
    </template>

    <!-- Empty state for compare mode -->
    <div v-if="!hasData && !loading && viewMode === 'compare'" class="empty-state">
      <p>请在顶部选择日期</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import StepsChart from './StepsChart.vue';
import CaloriesChart from './CaloriesChart.vue';
import HeartRateChart from './HeartRateChart.vue';
import StressChart from './StressChart.vue';
import SleepChart from './SleepChart.vue';
import SleepTimelineChart from './SleepTimelineChart.vue';
import DailySportChart from './DailySportChart.vue';
import SingleDayHeartRateChart from './SingleDayHeartRateChart.vue';
import WeightChart from './WeightChart.vue';

const props = defineProps({
  chartData: {
    type: Array,
    default: () => []
  },
  chartType: {
    type: String,
    default: 'steps'
  },
  viewMode: {
    type: String,
    default: 'single'
  },
  loading: {
    type: Boolean,
    default: false
  },
  sleepTimelineData: {
    type: Object,
    default: null
  },
  weightData: {
    type: Object,
    default: null
  }
});

const hasData = computed(() => props.chartData.length > 0);
</script>

<style scoped>
.chart-display {
  height: 100%;
}

.empty-state, .loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  background: #fff;
  border-radius: 8px;
}
</style>
