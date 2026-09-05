<template>
  <div class="chart-container">
    <SectionTitle>{{ t('chart.caloriesBurned') }}</SectionTitle>
    <div ref="chartRef" class="chart"></div>

    <div v-if="!hasData" class="empty-state">
      <p>{{ t('chart.selectDate') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { useLocaleStore } from '../../stores/localeStore.js';
import { useThemeStore } from '../../stores/themeStore.js';

const localeStore = useLocaleStore();
const themeStore = useThemeStore();
const { t } = localeStore;

const props = defineProps({
  data: {
    type: Array,
    required: true
  }
});

const chartRef = ref(null);
let chartInstance = null;

const hasData = computed(() => props.data.length > 0);

const chartData = computed(() => {
  return props.data.map(item => {
    const duration = Number(item.totalDurationMinutes || 0);
    const calories = Number(item.sportCalories || 0);
    const efficiency = duration > 0 && calories > 0
      ? Math.round((calories / duration) * 100) / 100
      : null;

    return {
      date: item.date,
      calories: Number.isFinite(calories) ? calories : 0,
      duration,
      efficiency
    };
  });
});

const avgCaloriesValue = computed(() => {
  const values = chartData.value
    .map(item => item.calories)
    .filter(value => Number.isFinite(value));

  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
});

function getThemeColors() {
  const isDark = themeStore.isDarkMode;
  return {
    textColor: isDark ? '#a8a8a8' : '#606266',
    axisLineColor: isDark ? '#3a3a3a' : '#e8e8e8',
    splitLineColor: isDark ? '#3a3a3a' : '#ebeef5'
  };
}

function buildOption() {
  const colors = getThemeColors();
  const dates = chartData.value.map(item => item.date);
  const calories = chartData.value.map(item => item.calories);
  const efficiencies = chartData.value.map(item => item.efficiency);
  const avgCalories = avgCaloriesValue.value;
  const avgCaloriesSeries = dates.map(() => avgCalories);

  const calorieValues = calories.filter(value => Number.isFinite(value));
  const efficiencyValues = efficiencies.filter(value => Number.isFinite(value));

  const calorieMax = calorieValues.length > 0 ? Math.max(...calorieValues) : 0;
  const calorieMin = calorieValues.length > 0 ? Math.min(...calorieValues) : 0;
  const caloriePadding = calorieValues.length > 0 ? Math.max(Math.round((calorieMax - calorieMin) * 0.15), 20) : 100;

  const efficiencyMax = efficiencyValues.length > 0 ? Math.max(...efficiencyValues) : 0;
  const efficiencyMin = efficiencyValues.length > 0 ? Math.min(...efficiencyValues) : 0;
  const efficiencyPadding = efficiencyValues.length > 0 ? Math.max(Number(((efficiencyMax - efficiencyMin) * 0.2).toFixed(2)), 0.1) : 0.5;

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        if (!params || params.length === 0) return '';

        const day = params[0].name;
        const caloriesItem = params.find(item => item.seriesName === t('chart.caloriesBurned'));
        const avgCaloriesItem = params.find(item => item.seriesName === t('chart.avgCaloriesLine'));
        const efficiencyItem = params.find(item => item.seriesName === t('chart.caloriesEfficiency'));
        const dataIndex = params[0].dataIndex;
        const item = chartData.value[dataIndex] || {};

        const lines = [`<strong>${day}</strong>`];
        if (caloriesItem && Number.isFinite(Number(caloriesItem.value))) {
          lines.push(`${caloriesItem.marker}${t('chart.caloriesBurned')}：${Math.round(Number(caloriesItem.value))} kcal`);
        }
        if (avgCaloriesItem && Number.isFinite(Number(avgCaloriesItem.value))) {
          lines.push(`${avgCaloriesItem.marker}${t('chart.avgCaloriesLine')}：${Math.round(Number(avgCaloriesItem.value))} kcal`);
        }
        if (efficiencyItem && Number.isFinite(Number(efficiencyItem.value))) {
          lines.push(`${efficiencyItem.marker}${t('chart.caloriesEfficiency')}：${Number(efficiencyItem.value).toFixed(2)} ${t('chart.caloriesEfficiencyUnit')}`);
        }
        if (Number(item.duration) > 0) {
          lines.push(`${t('chart.totalExerciseDuration')}：${Math.round(item.duration)} ${t('chart.minutes')}`);
        }
        return lines.join('<br/>');
      }
    },
    legend: {
      data: [t('chart.caloriesBurned'), t('chart.avgCaloriesLine'), t('chart.caloriesEfficiency')],
      right: 0,
      top: 0,
      textStyle: {
        color: colors.textColor
      }
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '12%',
      top: '14%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: {
        rotate: 45,
        fontSize: 11,
        color: colors.textColor
      },
      axisLine: {
        lineStyle: {
          color: colors.axisLineColor
        }
      }
    },
    yAxis: [
      {
        type: 'value',
        name: `${t('chart.caloriesBurned')} (kcal)`,
        min: calorieValues.length > 0 ? Math.max(0, Math.floor((calorieMin - caloriePadding) / 50) * 50) : 0,
        max: calorieValues.length > 0 ? Math.ceil((calorieMax + caloriePadding) / 50) * 50 : 1200,
        nameTextStyle: {
          color: colors.textColor
        },
        axisLabel: {
          formatter: (value) => `${value} kcal`,
          color: colors.textColor
        },
        axisLine: {
          lineStyle: {
            color: colors.axisLineColor
          }
        },
        splitLine: {
          lineStyle: {
            color: colors.splitLineColor
          }
        }
      },
      {
        type: 'value',
        name: t('chart.caloriesEfficiencyUnit'),
        position: 'right',
        min: efficiencyValues.length > 0 ? Math.max(0, Number((efficiencyMin - efficiencyPadding).toFixed(2))) : 0,
        max: efficiencyValues.length > 0 ? Number((efficiencyMax + efficiencyPadding).toFixed(2)) : 5,
        nameTextStyle: {
          color: colors.textColor
        },
        axisLabel: {
          formatter: (value) => `${Number(value).toFixed(1)}`,
          color: colors.textColor
        },
        axisLine: {
          lineStyle: {
            color: colors.axisLineColor
          }
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: t('chart.caloriesBurned'),
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#91cc75' },
            { offset: 1, color: '#73a35e' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            color: '#73a35e'
          }
        },
        data: calories
      },
      {
        name: t('chart.avgCaloriesLine'),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          color: '#ff7f50',
          width: 2,
          type: 'dashed'
        },
        itemStyle: {
          color: '#ff7f50'
        },
        data: avgCaloriesSeries
      },
      {
        name: t('chart.caloriesEfficiency'),
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: {
          color: '#5470c6',
          width: 2
        },
        itemStyle: {
          color: '#5470c6'
        },
        areaStyle: {
          color: 'rgba(84, 112, 198, 0.08)'
        },
        data: efficiencies
      }
    ]
  };
}

const initChart = () => {
  if (!chartRef.value) return;
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  updateChart();
};

const updateChart = () => {
  if (!chartInstance) return;

  if (!hasData.value) {
    chartInstance.clear();
    return;
  }

  chartInstance.setOption(buildOption(), true);
};

const handleResize = () => {
  chartInstance?.resize();
};

watch(() => props.data, updateChart, { deep: true });
watch(() => localeStore.currentLocale, updateChart);
watch(() => themeStore.isDarkMode, updateChart);

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  chartInstance?.dispose();
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.chart-container {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart {
  width: 100%;
  flex: 1;
  min-height: 420px;
}

.chart :deep(canvas) {
  max-width: 100%;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--card-border);
  min-height: 320px;
}
</style>
