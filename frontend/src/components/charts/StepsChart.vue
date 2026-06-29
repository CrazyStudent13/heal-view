<template>
  <div class="chart-container">
    <h3 class="chart-title">步数趋势</h3>
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { useStepsChartConfig } from '../../composables/useChartConfig.js';

const props = defineProps({
  data: {
    type: Array,
    required: true
  }
});

const chartRef = ref(null);
let chartInstance = null;

const initChart = () => {
  if (!chartRef.value) return;

  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance) return;

  const config = useStepsChartConfig();

  // Extract dates and steps from data
  const dates = props.data.map(item => item.date);
  const steps = props.data.map(item => item.steps);

  config.xAxis.data = dates;
  config.series[0].data = steps;

  chartInstance.setOption(config);
};

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

onMounted(() => {
  initChart();

  // Responsive resize
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose();
  }
  window.removeEventListener('resize', handleResize);
});

const handleResize = () => {
  chartInstance?.resize();
};
</script>

<style scoped>
.chart-container {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.chart-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
  font-weight: 500;
}

.chart {
  width: 100%;
  height: 300px;
}
</style>
