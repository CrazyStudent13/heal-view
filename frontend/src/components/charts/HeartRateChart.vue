<template>
  <div class="chart-container">
    <h3 class="chart-title">心率监测</h3>
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { useHeartRateChartConfig } from '../../composables/useChartConfig.js';

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

  const config = useHeartRateChartConfig();

  // Extract dates and heart rates from data
  const dates = props.data.map(item => item.date);
  const avgHR = props.data.map(item => item.avgHeartRate);
  const maxHR = props.data.map(item => item.maxHeartRate);

  config.xAxis.data = dates;
  config.series[0].data = avgHR;
  config.series[1].data = maxHR;

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
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
}

.chart-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
}

.chart {
  width: 100%;
  height: 300px;
}
</style>
