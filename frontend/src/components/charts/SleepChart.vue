<template>
  <div class="chart-container">
    <h3 class="chart-title">{{ t('data.sleep') }}分析</h3>
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

  const dates = props.data.map(item => item.date);
  const deepSleep = props.data.map(item => item.deepSleepHours || 0);
  const lightSleep = props.data.map(item => item.lightSleepHours || 0);
  const remSleep = props.data.map(item => item.remSleepHours || 0);

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
        result += `<strong>总睡眠: ${total.toFixed(1)} h</strong>`;
        return result;
      }
    },
    legend: {
      data: ['深睡', '浅睡', 'REM'],
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
      name: '小时(h)',
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
        name: '深睡',
        type: 'bar',
        stack: 'sleep',
        emphasis: {
          focus: 'series'
        },
        itemStyle: {
          color: '#5b8ff9'
        },
        data: deepSleep
      },
      {
        name: '浅睡',
        type: 'bar',
        stack: 'sleep',
        emphasis: {
          focus: 'series'
        },
        itemStyle: {
          color: '#5ad8a6'
        },
        data: lightSleep
      },
      {
        name: 'REM',
        type: 'bar',
        stack: 'sleep',
        emphasis: {
          focus: 'series'
        },
        itemStyle: {
          color: '#f6bd60'
        },
        data: remSleep
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
}

.chart-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
}

.chart {
  width: 100%;
  height: 400px;
}
</style>
