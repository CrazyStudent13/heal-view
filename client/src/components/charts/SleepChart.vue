<template>
  <div class="chart-container" v-if="hasValidData">
    <SectionTitle>{{ t('data.sleep') }}{{ t('chart.sleepAnalysis') }}</SectionTitle>

    <div v-if="sleepRegularityMetrics.length > 0" class="regularity-cards">
      <el-card class="regularity-card" :class="bedtimeRegularity.status" shadow="hover">
        <div class="regularity-card-head">
          <div class="regularity-card-title">
            {{ t('sleep.bedtimeRegularity') }}
            <el-tooltip :content="regularityTipContent" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          <el-tag :type="regularityTagType(bedtimeRegularity.status)" size="small" effect="light">
            {{ regularityStatusLabel(bedtimeRegularity.status) }}
          </el-tag>
        </div>
        <div class="regularity-score">{{ regularityScoreText(bedtimeRegularity) }}</div>
        <div class="regularity-meta">{{ regularityMetaText(bedtimeRegularity) }}</div>
      </el-card>

      <el-card class="regularity-card" :class="wakeRegularity.status" shadow="hover">
        <div class="regularity-card-head">
          <div class="regularity-card-title">
            {{ t('sleep.wakeRegularity') }}
            <el-tooltip :content="regularityTipContent" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          <el-tag :type="regularityTagType(wakeRegularity.status)" size="small" effect="light">
            {{ regularityStatusLabel(wakeRegularity.status) }}
          </el-tag>
        </div>
        <div class="regularity-score">{{ regularityScoreText(wakeRegularity) }}</div>
        <div class="regularity-meta">{{ regularityMetaText(wakeRegularity) }}</div>
      </el-card>
    </div>

    <div ref="chartRef" class="chart"></div>
  </div>

  <div class="empty-state" v-else>
    <el-empty :description="t('chart.noSleepData')" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, watch, ref } from 'vue';
import * as echarts from 'echarts';
import { ElEmpty } from 'element-plus';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore';

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

function parseTimeToMinutes(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60 + minutes) % 1440;
}

function formatMinutesToTime(minutes) {
  if (!Number.isFinite(minutes)) return '--';
  const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(value / 60)).padStart(2, '0');
  const mins = String(value % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

function circularDistance(a, b) {
  const diff = Math.abs(a - b) % 1440;
  return Math.min(diff, 1440 - diff);
}

function circularMean(values) {
  if (!values.length) return null;
  let sinSum = 0;
  let cosSum = 0;
  values.forEach((value) => {
    const angle = (value / 1440) * Math.PI * 2;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  });
  if (sinSum === 0 && cosSum === 0) return null;
  let angle = Math.atan2(sinSum / values.length, cosSum / values.length);
  if (angle < 0) angle += Math.PI * 2;
  return (angle / (Math.PI * 2)) * 1440;
}

function assessRegularity(times) {
  const validTimes = times
    .map(parseTimeToMinutes)
    .filter(value => Number.isFinite(value));

  if (validTimes.length === 0) {
    return {
      score: null,
      matched: 0,
      total: 0,
      referenceTime: '--',
      status: 'none'
    };
  }

  const reference = circularMean(validTimes);
  const referenceTime = reference === null ? '--' : formatMinutesToTime(reference);
  const tolerance = 90;
  const matched = validTimes.filter(value => circularDistance(value, reference) <= tolerance).length;
  const score = Math.round((matched / validTimes.length) * 100) / 10;

  let status = 'chaotic';
  if (score >= 7) status = 'regular';
  else if (score >= 4) status = 'mixed';

  return {
    score,
    matched,
    total: validTimes.length,
    referenceTime,
    status
  };
}

const sleepSummaryList = computed(() => {
  return Array.isArray(props.timelineList)
    ? props.timelineList.filter(item => item && (item.bedtime || item.wakeUpTime))
    : [];
});

const bedtimeRegularity = computed(() => assessRegularity(sleepSummaryList.value.map(item => item.bedtime)));
const wakeRegularity = computed(() => assessRegularity(sleepSummaryList.value.map(item => item.wakeUpTime)));
const sleepRegularityMetrics = computed(() => [bedtimeRegularity.value, wakeRegularity.value].filter(item => item.total > 0));

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
  if (!chartRef.value) return;
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
  padding: 16px 20px 18px;
  border-radius: 8px;
  margin-bottom: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  box-sizing: border-box;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.regularity-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0 10px;
}

.regularity-card {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 6px 10px;
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

.regularity-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.regularity-card-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.help-icon {
  font-size: 12px;
  cursor: help;
}

.regularity-score {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
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
}

.chart {
  width: 100%;
  flex: 1;
  min-height: 0;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #999;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--card-border);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
