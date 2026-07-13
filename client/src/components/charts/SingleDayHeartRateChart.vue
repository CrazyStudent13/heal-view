<template>
  <div class="chart-container">
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
    
    <!-- Loading state -->
    <div v-if="loading" class="loading-overlay">
      <p>{{ t('common.loading') }}</p>
    </div>
    
    <!-- Empty state -->
    <div v-if="!loading && heartRateData.length === 0" class="empty-state">
      <p>{{ t('nav.selectDateToView') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { useLocaleStore } from '../../stores/localeStore.js';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';

const localeStore = useLocaleStore();
const { t } = localeStore;
const dateStore = useDateStore();
const dataStore = useDataStore();

const chartRef = ref(null);
let chartInstance = null;
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
  if (!chartRef.value) return;
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
          return `${param.name}<br/>${param.marker}无数据`;
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
    
    // Update chart after data is loaded
    setTimeout(() => {
      updateChart();
    }, 100);
  }
}, { immediate: true });

onMounted(() => {
  setTimeout(() => {
    initChart();
  }, 100);
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
  position: relative;
  height: 100%; /* Use full height to match sidebar */
  display: flex;
  flex-direction: column;
}

.chart-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
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

.loading-overlay, .empty-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  color: #999;
  font-size: 14px;
}

.empty-state {
  background: transparent;
}
</style>
