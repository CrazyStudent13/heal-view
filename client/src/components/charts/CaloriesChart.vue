<!-- 模块：卡路里趋势图，展示每日消耗与摄入相关数据。 -->
<template>
  <ChartPanel :empty="!hasData" :empty-description="t('chart.selectDate')">
    <template #title>
      <SectionTitle>
        {{ t('chart.caloriesBurned') }}
        <template #actions><DateSelectionControls /></template>
      </SectionTitle>
    </template>

    <div ref="chartRef" class="chart"></div>
  </ChartPanel>
</template>

<script setup>
import echarts from '@/lib/echarts';
import { useEchartsInstance, useEchartsThemeColors } from '@/composables/useEchartsInstance.js';
import { useLocaleStore } from '@/stores/localeStore.js';
import { calculateCalorieEfficiency } from '@/domain/healthRules.js';
import { formatDate } from '@/i18n/index.js';
import ChartPanel from '@/components/ui/ChartPanel.vue';
import DateSelectionControls from '@/components/ui/DateSelectionControls.vue';

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

const hasData = computed(() => props.data.length > 0);

const chartData = computed(() => {
  return props.data.map(item => {
    const duration = Number(item.totalDurationMinutes || 0);
    const calories = Number(item.sportCalories || 0);
    const efficiency = calculateCalorieEfficiency(calories, duration);

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

function buildOption() {
  const colors = themeColors.value;
  const dates = chartData.value.map(item => formatDate(item.date));
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
          lines.push(`${caloriesItem.marker}${t('chart.caloriesBurned')}${t('common.labelSeparator')}${Math.round(Number(caloriesItem.value))} ${t('settings.units.kcal')}`);
        }
        if (avgCaloriesItem && Number.isFinite(Number(avgCaloriesItem.value))) {
          lines.push(`${avgCaloriesItem.marker}${t('chart.avgCaloriesLine')}${t('common.labelSeparator')}${Math.round(Number(avgCaloriesItem.value))} ${t('settings.units.kcal')}`);
        }
        if (efficiencyItem && Number.isFinite(Number(efficiencyItem.value))) {
          lines.push(`${efficiencyItem.marker}${t('chart.caloriesEfficiency')}${t('common.labelSeparator')}${Number(efficiencyItem.value).toFixed(2)} ${t('chart.caloriesEfficiencyUnit')}`);
        }
        if (Number(item.duration) > 0) {
          lines.push(`${t('chart.totalExerciseDuration')}${t('common.labelSeparator')}${Math.round(item.duration)} ${t('chart.minutes')}`);
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
        name: `${t('chart.caloriesBurned')} (${t('settings.units.kcal')})`,
        min: calorieValues.length > 0 ? Math.max(0, Math.floor((calorieMin - caloriePadding) / 50) * 50) : 0,
        max: calorieValues.length > 0 ? Math.ceil((calorieMax + caloriePadding) / 50) * 50 : 1200,
        nameTextStyle: {
          color: colors.textColor
        },
        axisLabel: {
          formatter: (value) => `${value} ${t('settings.units.kcal')}`,
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
  initChartInstance(updateChart);
};

const updateChart = () => {
  if (!chartInstance.value) return;

  if (!hasData.value) {
    chartInstance.value.clear();
    return;
  }

  chartInstance.value.setOption(buildOption(), true);
};

watch(() => props.data, updateChart, { deep: true });
watch(() => localeStore.currentLocale, updateChart);
watch(themeColors, updateChart);

onMounted(initChart);
</script>

<style scoped lang="scss">
.chart {
  width: 100%;
  flex: 1;
  min-height: 420px;
}

.chart :deep(canvas) {
  max-width: 100%;
}
</style>

