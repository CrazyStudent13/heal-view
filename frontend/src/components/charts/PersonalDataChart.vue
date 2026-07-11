<template>
  <div class="chart-container">
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
  profileData: {
    type: Object,
    default: null
  }
});

const chartRef = ref(null);
let chartInstance = null;

const initChart = () => {
  if (!chartRef.value || !props.profileData) return;
  
  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance || !props.profileData) return;

  const bmi = props.profileData.bmi || 0;
  const bmiRef = props.profileData.bmiReference;
  
  if (!bmiRef) return;

  const isDark = document.documentElement.classList.contains('dark-theme');
  const textColor = isDark ? '#a8a8a8' : '#606266';

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

  chartInstance.setOption(option, true);
};

watch(() => props.profileData, () => {
  if (chartInstance) {
    updateChart();
  }
}, { deep: true });

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
  width: 100%;
  height: 300px;
  margin-top: 16px;
}

.chart {
  width: 100%;
  height: 100%;
}
</style>
