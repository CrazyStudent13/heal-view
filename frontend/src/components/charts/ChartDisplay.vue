<template>
  <div class="chart-display">
    <!-- Charts based on selected type -->
    <StepsChart v-if="chartType === 'steps' && hasData" :data="chartData" />
    <CaloriesChart v-if="chartType === 'calories' && hasData" :data="chartData" />
    <HeartRateChart v-if="chartType === 'heartrate' && hasData" :data="chartData" />
    <StressChart v-if="chartType === 'stress' && hasData" :data="chartData" />

    <!-- Empty state -->
    <div v-if="!hasData" class="empty-state">
      <p>{{ viewMode === 'compare' ? '请在顶部选择日期' : '请在顶部选择日期查看数据' }}</p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import StepsChart from './StepsChart.vue';
import CaloriesChart from './CaloriesChart.vue';
import HeartRateChart from './HeartRateChart.vue';
import StressChart from './StressChart.vue';

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
