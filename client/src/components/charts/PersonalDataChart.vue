<template>
  <ChartPanel :empty="!profileData" :empty-description="t('chart.noData')">
    <div ref="chartRef" class="chart"></div>
  </ChartPanel>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useEchartsInstance, useEchartsThemeColors } from '@/composables/useEchartsInstance.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import ChartPanel from '@/components/ui/ChartPanel.vue';

const localeStore = useLocaleStore();
const { t } = localeStore;
const themeColors = useEchartsThemeColors();

const props = defineProps({
  profileData: {
    type: Object,
    default: null
  }
});

const chartRef = ref(null);
const { chartInstance, initChart: initChartInstance } = useEchartsInstance(chartRef);
let initTimer = null;

const initChart = () => {
  if (!props.profileData) return;
  initChartInstance(updateChart);
};

const updateChart = () => {
  if (!chartInstance.value) return;

  if (!props.profileData) {
    chartInstance.value.clear();
    return;
  }

  const bmi = props.profileData.bmi || 0;
  const bmiRef = props.profileData.bmiReference;
  
  if (!bmiRef) return;

  const { textColor } = themeColors.value;

  // BMI reference ranges
  const ranges = [
    { name: t('personal.bmiUnderweight'), start: 0, end: 18.5, color: '#1890ff' },
    { name: t('personal.bmiNormal'), start: 18.5, end: 24, color: '#52c41a' },
    { name: t('personal.bmiOverweight'), start: 24, end: 28, color: '#fa8c16' },
    { name: t('personal.bmiObese'), start: 28, end: 35, color: '#ff4d4f' }
  ];

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        return `BMI: ${params[0].value}`;
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
      type: 'value',
      min: 15,
      max: 35,
      name: 'BMI',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: {
        color: textColor
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'category',
      data: [''],
      show: false
    },
    series: [
      // Background ranges
      ...ranges.map(range => ({
        type: 'bar',
        stack: 'range',
        barWidth: 40,
        silent: true,
        itemStyle: {
          color: range.color,
          opacity: 0.3
        },
        data: [{
          value: range.end - range.start,
          itemStyle: {
            color: range.color
          }
        }],
        z: 1
      })),
      // User's BMI marker
      {
        type: 'scatter',
        symbol: 'circle',
        symbolSize: 16,
        data: [bmi],
        itemStyle: {
          color: '#fff',
          borderColor: '#333',
          borderWidth: 3,
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.3)'
        },
        label: {
          show: true,
          formatter: `${bmi}`,
          position: 'top',
          fontSize: 14,
          fontWeight: 'bold',
          color: textColor
        },
        z: 10
      },
      // Vertical line at user's BMI
      {
        type: 'line',
        data: [[bmi, -0.5], [bmi, 0.5]],
        lineStyle: {
          color: '#333',
          width: 2,
          type: 'dashed'
        },
        showSymbol: false,
        z: 9
      }
    ]
  };

  chartInstance.value.setOption(option, true);
};

watch(() => props.profileData, () => {
  if (chartInstance.value) updateChart();
  else initChart();
}, { deep: true });
watch(themeColors, updateChart);

onMounted(() => {
  initTimer = setTimeout(() => {
    initTimer = null;
    initChart();
  }, 100);
});

onBeforeUnmount(() => {
  if (initTimer) {
    clearTimeout(initTimer);
    initTimer = null;
  }
});
</script>

<style scoped lang="scss">
.chart {
  width: 100%;
  min-height: 300px;
}
</style>

