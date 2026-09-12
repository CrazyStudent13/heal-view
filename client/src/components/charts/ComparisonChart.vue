<template>
  <ChartPanel :empty="data.length === 0" :empty-description="t('chart.selectDate')">
    <template #title>
      <SectionTitle>{{ t('nav.multiDay') }}{{ t('chart.steps') }}{{ t('chart.trend') }}</SectionTitle>
    </template>
    <div ref="chartRef" class="chart"></div>
  </ChartPanel>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import echarts from '../../lib/echarts';
import { useLocaleStore } from '../../stores/localeStore.js';
import ChartPanel from '../common/ChartPanel.vue';

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

const initChart = () => {
  if (!chartRef.value || chartInstance) return;
  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance || props.data.length === 0) return;

  const dates = props.data.map(item => item.date);
  const steps = props.data.map(item => item.steps);

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
        return `${data.name}<br/>${t('chart.steps')}: ${data.value.toLocaleString()} ${t('chart.unitSteps')}`;
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
      name: t('chart.steps'),
      nameTextStyle: {
        color: textColor
      },
      axisLabel: {
        formatter: (value) => `${(value / 1000).toFixed(0)}k`,
        color: textColor
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
      name: t('chart.steps'),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        color: '#5470c6',
        width: 2
      },
      itemStyle: {
        color: '#5470c6'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(84, 112, 198, 0.3)' },
          { offset: 1, color: 'rgba(84, 112, 198, 0.05)' }
        ])
      },
      data: steps
    }]
  };

  chartInstance.setOption(option);
};

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

watch(() => localeStore.currentLocale, updateChart);

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose();
    chartInstance = null;
  }
  window.removeEventListener('resize', handleResize);
});

const handleResize = () => {
  chartInstance?.resize();
};
</script>

<style scoped lang="scss">
.chart {
  width: 100%;
  flex: 1;
  min-height: 300px;
}
</style>

