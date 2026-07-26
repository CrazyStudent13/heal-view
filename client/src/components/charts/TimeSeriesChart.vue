<template>
  <div class="time-series-chart">
    <SectionTitle>{{ t('chart.dailyActivityTrend') }}</SectionTitle>
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { useLocaleStore } from '../../stores/localeStore.js';

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  stepsData: {
    type: Array,
    default: () => []
  },
  heartRateData: {
    type: Array,
    default: () => []
  }
});

const chartRef = ref(null);
let chartInstance = null;

// Convert timestamp to time string (HH:mm)
function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Filter out night time data (23:00 - 08:00)
function filterNightData(data) {
  if (!data || data.length === 0) return [];
  
  return data.filter(item => {
    const date = new Date(item.time * 1000);
    const hour = date.getHours();
    // Keep data from 08:00 to 23:00 (exclude 23:00-08:00)
    return hour >= 8 && hour < 23;
  });
}

const initChart = () => {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance) return;

  console.log('[TimeSeriesChart] Updating chart with data:');
  console.log('  Steps data length:', props.stepsData.length);
  console.log('  Heart rate data length:', props.heartRateData.length);

  // Filter out night time data (23:00 - 08:00)
  const filteredStepsData = filterNightData(props.stepsData);
  const filteredHrData = filterNightData(props.heartRateData);

  console.log('  Filtered steps data length:', filteredStepsData.length);
  console.log('  Filtered heart rate data length:', filteredHrData.length);

  // Process steps data
  const stepsTimes = filteredStepsData.map(item => formatTime(item.time));
  const stepsValues = filteredStepsData.map(item => item.value || 0);

  // Process heart rate data
  const hrTimes = filteredHrData.map(item => formatTime(item.time));
  const hrValues = filteredHrData.map(item => item.value || 0);

  console.log('  Chart will render with', stepsTimes.length, 'time points');

  // Get theme colors
  const isDark = document.documentElement.classList.contains('dark-theme');
  const textColor = isDark ? '#a8a8a8' : '#606266';
  const axisLineColor = isDark ? '#3a3a3a' : '#e8e8e8';
  const splitLineColor = isDark ? '#3a3a3a' : '#ebeef5';

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params) => {
        let result = `${params[0].name}<br/>`;
        params.forEach(param => {
          if (param.seriesName === t('chart.steps')) {
            result += `${param.marker}${t('chart.steps')}: ${param.value.toLocaleString()} ${t('chart.unitSteps')}<br/>`;
          } else if (param.seriesName === t('data.heartRate')) {
            result += `${param.marker}${t('data.heartRate')}: ${param.value} bpm<br/>`;
          }
        });
        return result;
      }
    },
    legend: {
      data: [t('chart.steps'), t('data.heartRate')],
      right: 10,
      top: 0,
      textStyle: {
        color: textColor
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: stepsTimes.length > 0 ? stepsTimes : hrTimes,
      axisLabel: {
        rotate: 45,
        fontSize: 11,
        color: textColor,
        margin: 8,
        interval: 'auto'
      },
      axisLine: {
        lineStyle: {
          color: axisLineColor
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        name: t('chart.steps'),
        position: 'left',
        nameTextStyle: {
          color: '#1890ff',
          fontSize: 12
        },
        axisLabel: {
          color: '#1890ff',
          formatter: (value) => (value / 1000).toFixed(0) + 'k'
        },
        axisLine: {
          lineStyle: {
            color: '#1890ff'
          }
        },
        splitLine: {
          lineStyle: {
            color: splitLineColor
          }
        }
      },
      {
        type: 'value',
        name: t('data.heartRate') + ' (bpm)',
        position: 'right',
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
          show: false
        }
      }
    ],
    series: [
      {
        name: t('chart.steps'),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        yAxisIndex: 0,
        lineStyle: {
          color: '#1890ff',
          width: 2
        },
        itemStyle: {
          color: '#1890ff'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
          ])
        },
        data: stepsValues
      },
      {
        name: t('data.heartRate'),
        type: 'line',
        smooth: true,
        symbol: 'diamond',
        symbolSize: 6,
        yAxisIndex: 1,
        lineStyle: {
          color: '#ff4d4f',
          width: 2,
          type: 'dashed'
        },
        itemStyle: {
          color: '#ff4d4f'
        },
        data: hrValues
      }
    ]
  };

  chartInstance.setOption(option);
};

watch(() => [props.stepsData, props.heartRateData], () => {
  if (chartInstance && (props.stepsData.length > 0 || props.heartRateData.length > 0)) {
    updateChart();
  }
}, { deep: true });

watch(() => localeStore.currentLocale, () => {
  if (chartInstance) updateChart();
});

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
.time-series-chart {
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
  text-align: left;
}

.chart {
  width: 100%;
  height: 350px;
}
</style>
