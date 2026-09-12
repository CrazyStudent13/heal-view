<template>
  <div class="chart-wrapper">
    <div v-if="hasSleepRegularityMetrics" class="stats-card">
      <SectionTitle>
        {{ t('sleep.regularityTitle') }}
        <template #actions><DateSelectionControls /></template>
      </SectionTitle>
      <div class="chart-metrics-grid chart-metrics-grid--2 regularity-cards">
        <MetricCard class="regularity-card" :class="bedtimeRegularity.status" compact layout="row">
          <template #icon><span class="regularity-icon bedtime-icon">🌙</span></template>
          <template #label>
            <span class="regularity-card-title">
              {{ t('sleep.bedtimeRegularity') }}
              <el-tooltip :content="regularityTipContent" placement="top" raw-content>
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <template #badge>
            <el-tag :type="regularityTagType(bedtimeRegularity.status)" size="small" effect="light">
              {{ regularityStatusLabel(bedtimeRegularity.status) }}
            </el-tag>
          </template>
          <template #value>
            <div class="regularity-score">{{ regularityScoreText(bedtimeRegularity) }}</div>
          </template>
          <template #footer>
            <div class="regularity-meta">{{ regularityMetaText(bedtimeRegularity) }}</div>
          </template>
        </MetricCard>

        <MetricCard class="regularity-card" :class="wakeRegularity.status" compact layout="row">
          <template #icon><span class="regularity-icon wake-icon">⏰</span></template>
          <template #label>
            <span class="regularity-card-title">
              {{ t('sleep.wakeRegularity') }}
              <el-tooltip :content="regularityTipContent" placement="top" raw-content>
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <template #badge>
            <el-tag :type="regularityTagType(wakeRegularity.status)" size="small" effect="light">
              {{ regularityStatusLabel(wakeRegularity.status) }}
            </el-tag>
          </template>
          <template #value>
            <div class="regularity-score">{{ regularityScoreText(wakeRegularity) }}</div>
          </template>
          <template #footer>
            <div class="regularity-meta">{{ regularityMetaText(wakeRegularity) }}</div>
          </template>
        </MetricCard>
      </div>
    </div>

    <ChartPanel :empty="!hasValidData" :empty-description="t('chart.noSleepData')">
      <template #title>
        <SectionTitle>{{ t('chart.sleepStageAnalysis') }}</SectionTitle>
      </template>
      <div ref="chartRef" class="chart"></div>
    </ChartPanel>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, watch, ref } from 'vue';
import echarts from '../../lib/echarts';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore';
import { assessSleepRegularity } from '../../domain/healthRules.js';
import MetricCard from '../common/MetricCard.vue';
import ChartPanel from '../common/ChartPanel.vue';
import DateSelectionControls from '../common/DateSelectionControls.vue';

const localeStore = useLocaleStore();

// Translation function
function t(key, params) {
  return localeStore.t(key, params);
}

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  timelineList: {
    type: Array,
    default: () => []
  }
});

const chartRef = ref(null);
let chartInstance = null;

const sleepSummaryList = computed(() => {
  return Array.isArray(props.timelineList)
    ? props.timelineList.filter(item => item && (item.bedtime || item.wakeUpTime))
    : [];
});

const bedtimeRegularity = computed(() => assessSleepRegularity(sleepSummaryList.value.map(item => item.bedtime)));
const wakeRegularity = computed(() => assessSleepRegularity(sleepSummaryList.value.map(item => item.wakeUpTime)));
const sleepRegularityMetrics = computed(() => [bedtimeRegularity.value, wakeRegularity.value].filter(item => item.total > 0));
const hasSleepRegularityMetrics = computed(() => sleepRegularityMetrics.value.length > 0);

const regularityTipContent = computed(() => `
  <div style="line-height:1.8">
    <div style="font-weight:600;margin-bottom:4px">${t('sleep.regularityTipTitle')}</div>
    <div>${t('sleep.regularityTip')}</div>
  </div>
`);

function regularityScoreText(metrics) {
  if (metrics.score === null) return '-- / 10';
  return `${metrics.score.toFixed(1)} / 10`;
}

function regularityMetaText(metrics) {
  if (metrics.score === null) return t('sleep.regularityNoData');
  return `${t('sleep.regularityMatched', { matched: metrics.matched, total: metrics.total })} · ${t('sleep.regularityReference', { time: metrics.referenceTime })}`;
}

function regularityStatusLabel(status) {
  if (status === 'regular') return t('sleep.regularityRegular');
  if (status === 'mixed') return t('sleep.regularityMixed');
  if (status === 'chaotic') return t('sleep.regularityChaotic');
  return t('common.empty');
}

function regularityTagType(status) {
  if (status === 'regular') return 'success';
  if (status === 'mixed') return 'warning';
  if (status === 'chaotic') return 'danger';
  return 'info';
}

// Check if there is valid sleep data
const hasValidData = computed(() => {
  if (!props.data || props.data.length === 0) return false;

  return props.data.some(item => {
    const totalSleep = (item.deepSleepHours || 0)
      + (item.lightSleepHours || 0)
      + (item.remSleepHours || 0)
      + (item.awakeSleepHours || 0);
    return totalSleep > 0;
  });
});

const initChart = () => {
  if (!chartRef.value || chartInstance) return;
  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance || props.data.length === 0) return;

  const filteredData = props.data.filter(item => {
    const totalSleep = (item.deepSleepHours || 0)
      + (item.lightSleepHours || 0)
      + (item.remSleepHours || 0)
      + (item.awakeSleepHours || 0);
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
      bottom: '1%',
      top: '10%',
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
      max: 15,
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

  chartInstance.setOption(option, true);
};

const resizeAndUpdateChart = () => {
  nextTick(() => {
    chartInstance?.resize();
    updateChart();
  });
};

watch(() => props.data, () => {
  resizeAndUpdateChart();
}, { deep: true });

watch(() => props.timelineList, () => {
  resizeAndUpdateChart();
}, { deep: true });

watch(() => localeStore.currentLocale, resizeAndUpdateChart);

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
.chart-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  position: relative;
}

.stats-card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  flex-shrink: 0;
}

.regularity-cards {
  margin-bottom: 0;
}

.regularity-card.regular {
  background: rgba(82, 196, 26, 0.06);
  border-color: rgba(82, 196, 26, 0.2);
}

.regularity-card.mixed {
  background: rgba(250, 173, 20, 0.08);
  border-color: rgba(250, 173, 20, 0.22);
}

.regularity-card.chaotic {
  background: rgba(255, 77, 79, 0.06);
  border-color: rgba(255, 77, 79, 0.2);
}

.regularity-card {
  justify-content: flex-start;
  box-shadow: 0 1px 4px rgba(84, 112, 198, 0.05);
}

.regularity-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.regularity-card-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.regularity-icon {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 22px;
  flex-shrink: 0;
}

.bedtime-icon {
  background: rgba(250, 173, 20, 0.12);
  color: #faad14;
}

.wake-icon {
  background: rgba(84, 112, 198, 0.12);
  color: #3569dd;
}

.regularity-card :deep(.metric-card__header) {
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.regularity-card :deep(.metric-card__label-wrap) {
  gap: 8px;
}

.regularity-card :deep(.metric-card__label) {
  font-size: 12px;
  white-space: nowrap;
}

.regularity-card :deep(.metric-card__value) {
  text-align: left;
  white-space: nowrap;
  line-height: 1.15;
}

.regularity-card :deep(.metric-card__footer) {
  text-align: left;
}

.regularity-score {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
  text-align: left;
}

.regularity-card.regular .regularity-score {
  color: #52c41a;
}

.regularity-card.mixed .regularity-score {
  color: #faad14;
}

.regularity-card.chaotic .regularity-score {
  color: #ff4d4f;
}

.regularity-meta {
  margin-top: 3px;
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.25;
  text-align: left;
}

.chart {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>

