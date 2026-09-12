<template>
  <div class="chart-wrapper">
    <div v-if="hasData" class="stats-card">
      <SectionTitle>
        {{ t('chart.heartRateMonitor') }}
        <template #actions><DateSelectionControls /></template>
      </SectionTitle>
      <div class="chart-metrics-grid chart-metrics-grid--3">
        <MetricCard compact layout="row" class="heart-metric-card heart-metric-card--range">
          <template #icon><span class="heart-metric-icon">📊</span></template>
          <template #label>{{ t('chart.heartRateRange') }}</template>
          <template #value>{{ minHR }}-{{ maxHR }} <span class="metric-unit">{{ t('chart.unitBpm') }}</span></template>
        </MetricCard>

        <MetricCard compact layout="row" class="heart-metric-card heart-metric-card--avg">
          <template #icon><span class="heart-metric-icon">❤️</span></template>
          <template #label>{{ t('chart.avgHeartRate') }}</template>
          <template #value>{{ avgHR }} <span class="metric-unit">{{ t('chart.unitBpm') }}</span></template>
        </MetricCard>

        <MetricCard compact layout="row" class="heart-metric-card heart-metric-card--rest">
          <template #icon><span class="heart-metric-icon">🌙</span></template>
          <template #label>{{ t('chart.restingHeartRate') }}</template>
          <template #value>{{ restingHR }} <span class="metric-unit">{{ t('chart.unitBpm') }}</span></template>
        </MetricCard>
      </div>
    </div>

    <ChartPanel
      class="heart-chart-panel"
      :loading="loading"
      :empty="!loading && heartRateData.length === 0"
      :empty-description="t('nav.selectDateToView')"
      :empty-image-size="100"
      :loading-text="t('common.loading')"
    >
      <template #title>
        <SectionTitle>{{ t('chart.heartRateTrend') }}</SectionTitle>
      </template>

      <div ref="chartRef" class="chart"></div>
    </ChartPanel>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import echarts from '../../lib/echarts';
import { useLocaleStore } from '../../stores/localeStore.js';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';
import MetricCard from '../common/MetricCard.vue';
import ChartPanel from '../common/ChartPanel.vue';
import DateSelectionControls from '../common/DateSelectionControls.vue';

const localeStore = useLocaleStore();
const { t } = localeStore;
const dateStore = useDateStore();
const dataStore = useDataStore();

const chartRef = ref(null);
let chartInstance = null;
let initTimer = null;
let updateTimer = null;
let isUnmounted = false;
const heartRateData = ref([]);
const loading = ref(false);

// Calculate metrics from heart rate data
const hasData = computed(() => heartRateData.value.length > 0);

function isValidHeartRate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

const minHR = computed(() => {
  if (!hasData.value) return 0;
  const values = heartRateData.value.map(item => Number(item.value)).filter(isValidHeartRate);
  if (values.length === 0) return 0;
  return Math.min(...values);
});

const maxHR = computed(() => {
  if (!hasData.value) return 0;
  const values = heartRateData.value.map(item => Number(item.value)).filter(isValidHeartRate);
  if (values.length === 0) return 0;
  return Math.max(...values);
});

const avgHR = computed(() => {
  if (!hasData.value) return 0;
  const values = heartRateData.value.map(item => Number(item.value)).filter(isValidHeartRate);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / values.length);
});

const restingHR = computed(() => {
  if (!hasData.value) return 0;
  // Resting heart rate is typically the lowest heart rate during rest periods
  // We'll use the minimum value from early morning hours (before 8 AM) or the overall minimum
  const morningData = heartRateData.value.filter(item => {
    const date = new Date(item.time * 1000);
    return date.getHours() < 8;
  });
  
  if (morningData.length > 0) {
    const morningValues = morningData.map(item => Number(item.value)).filter(isValidHeartRate);
    if (morningValues.length === 0) return minHR.value;
    return Math.min(...morningValues);
  }
  
  // If no morning data, use overall minimum as fallback
  const allValues = heartRateData.value.map(item => Number(item.value)).filter(isValidHeartRate);
  if (allValues.length === 0) return 0;
  return Math.min(...allValues);
});

// Convert timestamp to time string (HH:mm)
function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

const initChart = () => {
  if (!chartRef.value || chartInstance || isUnmounted) return;
  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance) return;

  // Generate full day time labels (every hour from 00:00 to 23:00)
  const fullDayTimes = [];
  for (let hour = 0; hour < 24; hour++) {
    fullDayTimes.push(`${hour.toString().padStart(2, '0')}:00`);
  }

  // Create a map of existing data by rounding to nearest hour
  const dataByHour = new Map();
  heartRateData.value.filter(item => isValidHeartRate(item.value)).forEach(item => {
    const date = new Date(item.time * 1000);
    const hourKey = `${date.getHours().toString().padStart(2, '0')}:00`;
    
    // If we already have data for this hour, average it
    if (dataByHour.has(hourKey)) {
      const existing = dataByHour.get(hourKey);
      dataByHour.set(hourKey, {
        sum: existing.sum + Number(item.value),
        count: existing.count + 1
      });
    } else {
      dataByHour.set(hourKey, {
        sum: Number(item.value),
        count: 1
      });
    }
  });

  // Calculate average values for each hour
  const fullDayValues = fullDayTimes.map(time => {
    if (dataByHour.has(time)) {
      const data = dataByHour.get(time);
      return Math.round(data.sum / data.count);
    }
    return null; // No data for this hour
  });

  // Get theme colors
  const isDark = document.documentElement.classList.contains('dark-theme');
  const textColor = isDark ? '#a8a8a8' : '#606266';
  const axisLineColor = isDark ? '#3a3a3a' : '#e8e8e8';
  const splitLineColor = isDark ? '#3a3a3a' : '#ebeef5';

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const param = params[0];
        if (param.value === null || param.value === undefined) {
          return `${param.name}<br/>${param.marker}${t('common.empty')}`;
        }
        return `${param.name}<br/>${param.marker}${t('data.heartRate')}: ${param.value} bpm`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: fullDayTimes,
      axisLabel: {
        rotate: 45,
        fontSize: 11,
        color: textColor,
        margin: 8,
        interval: 1 // Show every other label to avoid crowding
      },
      axisLine: {
        lineStyle: {
          color: axisLineColor
        }
      }
    },
    yAxis: {
      type: 'value',
      name: t('data.heartRate') + ' (bpm)',
      nameTextStyle: {
        color: '#ff4d4f',
        fontSize: 12
      },
      axisLabel: {
        color: '#ff4d4f',
        formatter: '{value}'
      },
      axisLine: {
        lineStyle: {
          color: '#ff4d4f'
        }
      },
      splitLine: {
        lineStyle: {
          color: splitLineColor
        }
      }
    },
    series: [
      {
        name: t('data.heartRate'),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        connectNulls: false, // Don't connect null values
        lineStyle: {
          color: '#ff4d4f',
          width: 2
        },
        itemStyle: {
          color: '#ff4d4f'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 77, 79, 0.3)' },
            { offset: 1, color: 'rgba(255, 77, 79, 0.05)' }
          ])
        },
        data: fullDayValues
      }
    ]
  };

  chartInstance.setOption(option);
};

// Fetch heart rate time series data when selected date changes
watch(() => dateStore.selectedDate, async (newDate) => {
  if (!newDate) {
    heartRateData.value = [];
    return;
  }

  loading.value = true;
  try {
    const hrData = await dataStore.fetchTimeSeries(newDate, 'heart_rate');
    if (hrData) {
      heartRateData.value = (hrData.data || []).filter(item => isValidHeartRate(item.value));
    } else {
      heartRateData.value = [];
    }
  } catch (error) {
    console.error('Failed to fetch heart rate time series data:', error);
    heartRateData.value = [];
  } finally {
    loading.value = false;
    if (isUnmounted) return;
    
    // Update chart after data is loaded
    updateTimer = setTimeout(() => {
      updateTimer = null;
      if (!isUnmounted) updateChart();
    }, 100);
  }
}, { immediate: true });

watch(() => localeStore.currentLocale, () => {
  if (chartInstance) updateChart();
});

onMounted(() => {
  initTimer = setTimeout(() => {
    initTimer = null;
    initChart();
  }, 100);
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  isUnmounted = true;
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
  if (initTimer) {
    clearTimeout(initTimer);
    initTimer = null;
  }
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }
  window.removeEventListener('resize', handleResize);
});

const handleResize = () => {
  chartInstance?.resize();
};
</script>

<style scoped lang="scss">
.metric-unit {
  font-size: 14px;
  font-weight: normal;
  color: #999;
}

.chart-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.stats-card {
  background: var(--card-bg);
  padding: 12px 14px 14px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  flex-shrink: 0;
}

.stats-card :deep(.chart-metrics-grid) {
  gap: 10px;
  margin-bottom: 0;
}

.heart-metric-card {
  text-align: left;
  min-height: 112px;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.heart-metric-card:hover {
  transform: translateY(-2px);
}

.heart-metric-card :deep(.metric-card__content--row) {
  align-items: flex-start;
  gap: 4px;
}

.heart-metric-card :deep(.metric-card__header--row) {
  align-items: center;
  gap: 6px;
}

.heart-metric-card :deep(.metric-card__label) {
  white-space: nowrap;
}

.heart-metric-card :deep(.metric-card__value--row) {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.heart-metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: rgba(64, 158, 255, 0.12);
  flex-shrink: 0;
}

.heart-metric-card--range .heart-metric-icon {
  background: rgba(64, 158, 255, 0.12);
}

.heart-metric-card--avg .heart-metric-icon {
  background: rgba(245, 108, 108, 0.12);
}

.heart-metric-card--rest .heart-metric-icon {
  background: rgba(250, 140, 22, 0.12);
}

.chart {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.heart-chart-panel {
  flex: 1 1 auto;
  min-height: 0;
}

.heart-chart-panel :deep(.chart-panel__body) {
  min-height: 0;
}
</style>

