<!-- 模块：压力趋势图，展示压力水平及其时间变化。 -->
<template>
  <ChartPanel :empty="data.length === 0" :empty-description="t('chart.noData')">
    <template #title>
      <SectionTitle>{{ t('data.stress') }}{{ t('chart.trend') }}</SectionTitle>
    </template>
    <div ref="chartRef" class="chart"></div>
  </ChartPanel>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import echarts from '@/lib/echarts';
import { useEchartsInstance, useEchartsThemeColors } from '@/composables/useEchartsInstance.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import ChartPanel from '@/components/ui/ChartPanel.vue';

const localeStore = useLocaleStore();
const { t } = localeStore;
const themeColors = useEchartsThemeColors();

const props = defineProps({
  data: {
    type: Array,
    required: true
  }
});

const chartRef = ref(null);
const { chartInstance, initChart: initChartInstance } = useEchartsInstance(chartRef);

const initChart = () => {
  initChartInstance(updateChart);
};

const updateChart = () => {
  if (!chartInstance.value) return;

  if (props.data.length === 0) {
    chartInstance.value.clear();
    return;
  }

  const dates = props.data.map(item => item.date);
  const stress = props.data.map(item => item.avgStress || 0);

  const { textColor, axisLineColor, splitLineColor } = themeColors.value;

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const data = params[0];
        return `${data.name}<br/>${t('data.stress')}: ${data.value}`;
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
      name: t('data.stress'),
      min: 0,
      max: 100,
      nameTextStyle: {
        color: textColor
      },
      axisLabel: {
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
      name: t('data.stress'),
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        color: '#722ed1',
        width: 2
      },
      itemStyle: {
        color: '#722ed1'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(114, 46, 209, 0.3)' },
          { offset: 1, color: 'rgba(114, 46, 209, 0.05)' }
        ])
      },
      data: stress
    }]
  };

  chartInstance.value.setOption(option);
};

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

watch(() => localeStore.currentLocale, updateChart);
watch(themeColors, updateChart);

onMounted(initChart);
</script>

<style scoped lang="scss">
.chart {
  width: 100%;
  flex: 1;
  min-height: 300px;
}
</style>

