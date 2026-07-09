<template>
  <div class="chart-container">
    <h3 class="chart-title">{{ t('data.sleep') }}{{ t('chart.sleepAnalysis') }}</h3>
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts';
import { useLocaleStore } from '../../stores/localeStore';

const localeStore = useLocaleStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

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
  if (!chartInstance || props.data.length === 0) return;

  // Filter out dates with no sleep data (total sleep hours = 0)
  const filteredData = props.data.filter(item => {
    const totalSleep = (item.deepSleepHours || 0) + 
                       (item.lightSleepHours || 0) + 
                       (item.remSleepHours || 0) +
                       (item.awakeSleepHours || 0);
    return totalSleep > 0;
  });

  if (filteredData.length === 0) {
    chartInstance.clear();
    return;
  }

  const dates = filteredData.map(item => item.date);
  const deepSleep = filteredData.map(item => item.deepSleepHours || 0);
  const lightSleep = filteredData.map(item => item.lightSleepHours || 0);
  const remSleep = filteredData.map(item => item.remSleepHours || 0);
  const awakeSleep = filteredData.map(item => item.awakeSleepHours || 0);

  // Get theme colors
  const isDark = document.documentElement.classList.contains('dark-theme');
  const textColor = isDark ? '#a8a8a8' : '#606266';
  const axisLineColor = isDark ? '#3a3a3a' : '#e8e8e8';
  const splitLineColor = isDark ? '#3a3a3a' : '#ebeef5';

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params) => {
        let result = `${params[0].name}<br/>`;
        params.forEach(param => {
          if (param.value > 0) {
            result += `${param.marker}${param.seriesName}: ${param.value} h<br/>`;
          }
        });
        const total = params.reduce((sum, param) => sum + param.value, 0);
        result += `<strong>${t('chart.totalSleep')}: ${total.toFixed(1)} h</strong>`;
        return result;
      }
    },
    legend: {
      data: [t('chart.deepSleep'), t('chart.lightSleep'), 'REM', t('chart.awakeSleep')],
      right: 10,
      top: 0,
      textStyle: {
        color: textColor
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        rotate: 45,
        fontSize: 12,
        color: textColor
      },
      axisLine: {
        lineStyle: {
          color: axisLineColor
        }
      }
    },
    yAxis: {
      type: 'value',
      name: t('chart.hours'),
      min: 0,
      max: 12,
      nameTextStyle: {
        color: textColor
      },
      axisLabel: {
        color: textColor,
        formatter: '{value} h'
      },
      axisLine: {
        lineStyle: {
          color: axisLineColor
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
        name: t('chart.deepSleep'),
        type: 'line',
        stack: 'sleep',
        smooth: true,
        symbol: 'none',
        emphasis: {
          focus: 'series'
        },
        lineStyle: {
          width: 0
        },
        areaStyle: {
          color: '#5b8ff9',
          opacity: 0.8
        },
        data: deepSleep
      },
      {
        name: t('chart.lightSleep'),
        type: 'line',
        stack: 'sleep',
        smooth: true,
        symbol: 'none',
        emphasis: {
          focus: 'series'
        },
        lineStyle: {
          width: 0
        },
        areaStyle: {
          color: '#5ad8a6',
          opacity: 0.8
        },
        data: lightSleep
      },
      {
        name: 'REM',
        type: 'line',
        stack: 'sleep',
        smooth: true,
        symbol: 'none',
        emphasis: {
          focus: 'series'
        },
        lineStyle: {
          width: 0
        },
        areaStyle: {
          color: '#f6bd60',
          opacity: 0.8
        },
        data: remSleep
      },
      {
        name: t('chart.awakeSleep'),
        type: 'line',
        stack: 'sleep',
        smooth: true,
        symbol: 'none',
        emphasis: {
          focus: 'series'
        },
        lineStyle: {
          width: 0
        },
        areaStyle: {
          color: '#ee6666',
          opacity: 0.8
        },
        data: awakeSleep
      }
    ]
  };

  chartInstance.setOption(option);
};

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

onMounted(() => {
  initChart();
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

.chart {
  width: 100%;
  flex: 1; /* Take remaining space */
  min-height: 300px;
}
</style>
