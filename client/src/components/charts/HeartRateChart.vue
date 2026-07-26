<template>
  <div class="chart-container">
    <SectionTitle>{{ t('chart.heartRateMonitor') }}</SectionTitle>
    <!-- Heart rate metrics cards -->
    <div class="metrics-cards" v-if="hasData">
      <div class="metric-card">
        <div class="metric-label">{{ t('chart.heartRateRange') }}</div>
        <div class="metric-value">{{ minHR }}-{{ maxHR }} <span class="metric-unit">{{ t('chart.unitBpm') }}</span></div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">{{ t('chart.avgHeartRate') }}</div>
        <div class="metric-value">{{ avgHR }} <span class="metric-unit">{{ t('chart.unitBpm') }}</span></div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">{{ t('chart.restingHeartRate') }}</div>
        <div class="metric-value">{{ restingHR }} <span class="metric-unit">{{ t('chart.unitBpm') }}</span></div>
      </div>
    </div>
    
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { useLocaleStore } from '../../stores/localeStore.js';
import { useHeartRateChartConfig } from '../../composables/useChartConfig.js';

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  data: {
    type: Array,
    required: true
  }
});

const chartRef = ref(null);
let chartInstance = null;

// Calculate metrics from heart rate data
function isValidHeartRate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function firstValidHeartRate(...values) {
  return values.find(value => isValidHeartRate(value));
}

const validHeartRateData = computed(() => {
  return props.data.filter(item =>
    isValidHeartRate(item.avgHeartRate) ||
    isValidHeartRate(item.maxHeartRate) ||
    isValidHeartRate(item.minHeartRate)
  );
});

const hasData = computed(() => validHeartRateData.value.length > 0);

const minHR = computed(() => {
  if (!hasData.value) return 0;
  const values = validHeartRateData.value
    .map(item => firstValidHeartRate(item.minHeartRate, item.avgHeartRate))
    .filter(isValidHeartRate)
    .map(Number);
  if (values.length === 0) return 0;
  return Math.min(...values);
});

const maxHR = computed(() => {
  if (!hasData.value) return 0;
  const values = validHeartRateData.value
    .map(item => firstValidHeartRate(item.maxHeartRate, item.avgHeartRate))
    .filter(isValidHeartRate)
    .map(Number);
  if (values.length === 0) return 0;
  return Math.max(...values);
});

const avgHR = computed(() => {
  if (!hasData.value) return 0;
  const values = validHeartRateData.value
    .map(item => item.avgHeartRate)
    .filter(isValidHeartRate)
    .map(Number);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / values.length);
});

const restingHR = computed(() => {
  if (!hasData.value) return 0;
  // For multi-day comparison, prefer daily minimum heart rate, fallback to daily average.
  const values = validHeartRateData.value
    .map(item => firstValidHeartRate(item.minHeartRate, item.avgHeartRate))
    .filter(isValidHeartRate)
    .map(Number);
  if (values.length === 0) return 0;
  return Math.min(...values);
});

const initChart = () => {
  if (!chartRef.value) return;

  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance) return;

  const config = useHeartRateChartConfig();

  // Extract dates and heart rates from data
  const dates = validHeartRateData.value.map(item => item.date);
  const avgHR = validHeartRateData.value.map(item => isValidHeartRate(item.avgHeartRate) ? Number(item.avgHeartRate) : null);
  const maxHR = validHeartRateData.value.map(item => {
    const value = firstValidHeartRate(item.maxHeartRate, item.avgHeartRate);
    return isValidHeartRate(value) ? Number(value) : null;
  });

  if (dates.length === 0) {
    chartInstance.clear();
    return;
  }

  config.xAxis.data = dates;
  config.series[0].data = avgHR;
  config.series[1].data = maxHR;

  const yValues = [...avgHR, ...maxHR].filter(isValidHeartRate).map(Number);
  if (yValues.length > 0) {
    const minValue = Math.min(...yValues);
    const maxValue = Math.max(...yValues);
    const padding = Math.max(Math.round((maxValue - minValue) * 0.15), 5);
    config.yAxis.min = Math.max(30, Math.floor((minValue - padding) / 5) * 5);
    config.yAxis.max = Math.ceil((maxValue + padding) / 5) * 5;
  }

  chartInstance.setOption(config);
};

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

watch(() => localeStore.currentLocale, updateChart);

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
  height: 100%; /* Use full height to match sidebar */
  display: flex;
  flex-direction: column;
}

.chart-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
  flex-shrink: 0;
}

.metrics-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.metric-card {
  background: rgba(255, 77, 79, 0.05);
  border: 1px solid rgba(255, 77, 79, 0.2);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  transition: all 0.2s;
}

.metric-card:hover {
  background: rgba(255, 77, 79, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.15);
}

.metric-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
  white-space: nowrap;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #ff4d4f;
}

.metric-unit {
  font-size: 14px;
  font-weight: normal;
  color: #999;
}

.chart {
  width: 100%;
  flex: 1; /* Take remaining space */
  min-height: 300px;
}
</style>
