<template>
  <div class="chart-container">
    <h3 class="chart-title">{{ t('data.sleep') }}趋势</h3>
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
  const sleepHours = props.data.map(item => item.sleepHours || 0);

  // Get theme colors
  const isDark = document.documentElement.classList.contains('dark-theme');
  const textColor = isDark ? '#a8a8a8' : '#606266';
  const axisLineColor = isDark ? '#3a3a3a' : '#e8e8e8';
  const splitLineColor = isDark ? '#3a3a3a' : '#ebeef5';

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const data = params[0];
        return `${data.name}<br/>${t('data.sleep')}: ${data.value} h`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
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
      name: t('data.sleep'),
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
    series: [{
      name: t('data.sleep'),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        color: '#fa8c16',
        width: 2
      },
      itemStyle: {
        color: '#fa8c16'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(250, 140, 22, 0.3)' },
          { offset: 1, color: 'rgba(250, 140, 22, 0.05)' }
        ])
      },
      data: sleepHours
    }]
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
  height: 350px;
}
</style>
