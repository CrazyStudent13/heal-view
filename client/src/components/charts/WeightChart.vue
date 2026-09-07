<template>
  <div class="chart-wrapper">
    <ChartLoadingSkeleton v-if="loading" :stat-count="6" :stat-columns="3" />
    <!-- Statistics cards -->
    <div v-if="!loading && metrics" class="stats-card">
      <SectionTitle>{{ t('weight.stats') }}</SectionTitle>
      <div class="chart-metrics-grid chart-metrics-grid--3">
        <MetricCard compact layout="row" class="weight-stat-card weight-stat-card--purple">
          <template #icon><span class="weight-stat-icon">⚖️</span></template>
          <template #label>{{ t('weight.heightWeight') }}</template>
          <template #value>{{ userHeight }}cm / {{ metrics.latestWeight || 0 }}{{ t('weight.kg') }}</template>
        </MetricCard>

        <MetricCard compact layout="row" class="weight-stat-card weight-stat-card--violet">
          <template #icon><span class="weight-stat-icon">📐</span></template>
          <template #label>{{ t('weight.bmi') }}</template>
          <template #badge>
            <el-tooltip :content="bmiTooltipContent" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #value>
            <span class="bmi-value-row">
              <span>{{ metrics.bmi || 0 }}</span>
              <el-tag v-if="metrics.bmi" :type="bmiTagType" size="small">{{ bmiCategory }}</el-tag>
            </span>
          </template>
        </MetricCard>

        <MetricCard compact layout="row" class="weight-stat-card weight-stat-card--orange">
          <template #icon><span class="weight-stat-icon">🔥</span></template>
          <template #label>{{ t('weight.avgDailyCalories') }}</template>
          <template #badge>
            <el-tooltip :content="caloriesTooltipContent" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #value>{{ formatNumber(metrics.avgDailyCalories || 0) }} {{ t('weight.kcal') }}</template>
        </MetricCard>

        <MetricCard compact layout="row" class="weight-stat-card weight-stat-card--rose">
          <template #icon><span class="weight-stat-icon">🎯</span></template>
          <template #label>{{ t('weight.initTargetWeight') }}</template>
          <template #value>{{ initTargetDisplay }}</template>
        </MetricCard>

        <MetricCard compact layout="row" class="weight-stat-card weight-stat-card--blue">
          <template #icon><span class="weight-stat-icon">📈</span></template>
          <template #label>{{ t('weight.highestWeight') }}</template>
          <template #value>{{ highestWeightDisplay }} {{ t('weight.kg') }}<span v-if="highestWeightDate" class="hw-date">（{{ highestWeightDate }}）</span></template>
        </MetricCard>

        <MetricCard compact layout="row" class="weight-stat-card weight-stat-card--green">
          <template #icon>
            <span class="weight-stat-icon weight-change-icon" :class="weightChangeClass">{{ weightChangeIcon }}</span>
          </template>
          <template #label>{{ t('weight.weightChange') }}</template>
          <template #value>
            <span :class="weightChangeValueClass">{{ weightChangeText }}</span>
          </template>
        </MetricCard>
      </div>
    </div>

    <!-- Chart card -->
    <ChartPanel
      v-show="!loading"
      :empty="!loading && dailyData.length === 0"
      :empty-description="t('chart.noData')"
    >
      <template #title>
        <SectionTitle>{{ t('weight.title') }}</SectionTitle>
      </template>
      <div ref="chartRef" class="chart"></div>
    </ChartPanel>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore.js';
import MetricCard from '../common/MetricCard.vue';
import ChartPanel from '../common/ChartPanel.vue';
import ChartLoadingSkeleton from '../common/ChartLoadingSkeleton.vue';

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  weightData: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const chartRef = ref(null);
let chartInstance = null;

// Metrics from weight data
const metrics = computed(() => {
  return props.weightData?.metrics || null;
});

// Daily data for chart
const dailyData = computed(() => {
  return props.weightData?.dailyData || [];
});

// User profile
const userProfile = computed(() => {
  return props.weightData?.userProfile || {};
});

const userHeight = computed(() => {
  return userProfile.value.height || '--';
});

// Highest weight display (handle both old number and new object format)
const highestWeightDisplay = computed(() => {
  if (!metrics.value) return 0;
  const hw = metrics.value.highestWeight;
  return typeof hw === 'object' ? hw.weight : hw;
});

const highestWeightDate = computed(() => {
  if (!metrics.value) return '';
  const hw = metrics.value.highestWeight;
  return typeof hw === 'object' ? hw.date : '';
});

// BMI category label for tag display
const bmiCategory = computed(() => {
  const bmi = metrics.value?.bmi;
  if (!bmi) return '';
  if (bmi < 18.5) return t('weight.bmiUnderweight');
  if (bmi < 24) return t('weight.bmiNormal');
  if (bmi < 28) return t('weight.bmiOverweight');
  return t('weight.bmiObese');
});

const bmiTagType = computed(() => {
  const bmi = metrics.value?.bmi;
  if (!bmi) return 'info';
  if (bmi < 18.5) return 'primary';
  if (bmi < 24) return 'success';
  if (bmi < 28) return 'warning';
  return 'danger';
});

// Initial → target weight display
const initTargetDisplay = computed(() => {
  const init = metrics.value?.initialWeight;
  const target = metrics.value?.targetWeight;
  if (init && target) return `${init}${t('weight.kg')} / ${target}${t('weight.kg')}`;
  if (target) return `${target} ${t('weight.kg')}`;
  return t('weight.noTarget');
});

// BMI tooltip with horizontal reference table
const bmiTooltipContent = computed(() => {
  const ref = metrics.value?.bmiReference;
  if (!ref) return t('weight.bmiFormula') + '<br/>' + t('weight.bmiDesc');

  return `<div style="line-height:1.8">
    ${t('weight.bmiFormula')} &nbsp; ${t('weight.bmiDesc')}（${ref.userHeight}cm）
    <table style="margin-top:6px;border-collapse:collapse;width:100%;text-align:center">
      <tr>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;background:#1890ff;color:#fff;font-weight:600">${t('weight.bmiUnderweight')}</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;background:#52c41a;color:#fff;font-weight:600">${t('weight.bmiNormal')}</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;background:#fa8c16;color:#fff;font-weight:600">${t('weight.bmiOverweight')}</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;background:#ff4d4f;color:#fff;font-weight:600">${t('weight.bmiObese')}</td>
      </tr>
      <tr>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#1890ff">&lt;18.5</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#52c41a">18.5-24</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#fa8c16">24-28</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#ff4d4f">≥28</td>
      </tr>
      <tr>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#1890ff">&lt; ${ref.underweight.weight}kg</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#52c41a">${ref.underweight.weight}-${ref.normal.weight}kg</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#fa8c16">${ref.normal.weight}-${ref.overweight.weight}kg</td>
        <td style="padding:4px 10px;border:1px solid #e0e0e0;color:#ff4d4f">&gt; ${ref.overweight.weight}kg</td>
      </tr>
    </table>
  </div>`;
});

// Calories tooltip: breakdown of BMR + sport calories
const caloriesTooltipContent = computed(() => {
  const bmr = metrics.value?.bmr || 0;
  const sport = metrics.value?.avgSportCalories || 0;
  const total = metrics.value?.avgDailyCalories || 0;
  const lines = [
    t('weight.caloriesFormula'),
    '',
    t('weight.bmrLabel') + '：' + formatNumber(bmr) + ' ' + t('weight.kcal'),
    t('weight.sportCalLabel') + '：' + formatNumber(sport) + ' ' + t('weight.kcal'),
    '━━━━━━━━━━━━',
    t('weight.totalCalLabel') + '：' + formatNumber(total) + ' ' + t('weight.kcal')
  ];
  return lines.join('<br/>');
});

// Weight change icon and class
const weightChangeIcon = computed(() => {
  if (!metrics.value) return '➖';
  const change = metrics.value.weightChange;
  if (change < 0) return '⬇️';
  if (change > 0) return '⬆️';
  return '➖';
});

const weightChangeClass = computed(() => {
  if (!metrics.value) return '';
  const change = metrics.value.weightChange;
  if (change < 0) return 'weight-down';
  if (change > 0) return 'weight-up';
  return 'weight-same';
});

const weightChangeValueClass = computed(() => {
  if (!metrics.value) return '';
  const change = metrics.value.weightChange;
  if (change < 0) return 'value-down';
  if (change > 0) return 'value-up';
  return '';
});

const weightChangeText = computed(() => {
  if (!metrics.value) return '0 kg';
  const change = metrics.value.weightChange;
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change} kg`;
});

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const initChart = () => {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance || dailyData.value.length === 0) return;

  const dates = dailyData.value.map(item => item.date);
  const weights = dailyData.value.map(item => item.avgWeight);

  const isDark = document.documentElement.classList.contains('dark-theme');
  const textColor = isDark ? '#a8a8a8' : '#606266';
  const axisLineColor = isDark ? '#3a3a3a' : '#e8e8e8';
  const splitLineColor = isDark ? '#3a3a3a' : '#ebeef5';

  // Build series array
  const series = [
    {
      name: t('weight.dailyAvgWeight'),
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
      data: weights
    }
  ];

  // Add target trend line: slopes from initial weight to target weight
  const legendData = [t('weight.dailyAvgWeight')];
  if (metrics.value?.initialWeight && metrics.value?.targetWeight && dates.length > 1) {
    const initW = metrics.value.initialWeight;
    const targetW = metrics.value.targetWeight;
    // Build a straight line from initial to target across the full date range
    const trendData = dates.map((_, i) => {
      const ratio = i / (dates.length - 1);
      return parseFloat((initW + (targetW - initW) * ratio).toFixed(1));
    });
    series.push({
      name: t('weight.targetWeight'),
      type: 'line',
      symbol: 'none',
      lineStyle: {
        color: '#52c41a',
        type: 'dashed',
        width: 2
      },
      itemStyle: {
        color: '#52c41a'
      },
      data: trendData
    });
    legendData.push(t('weight.targetWeight'));
  } else if (metrics.value?.targetWeight) {
    // Fallback: horizontal target line if no initial weight
    const targetLine = Array(dates.length).fill(metrics.value.targetWeight);
    series.push({
      name: t('weight.targetWeight'),
      type: 'line',
      symbol: 'none',
      lineStyle: {
        color: '#52c41a',
        type: 'dashed',
        width: 2
      },
      itemStyle: {
        color: '#52c41a'
      },
      data: targetLine
    });
    legendData.push(t('weight.targetWeight'));
  }

  // Calculate Y-axis range: ensure data, initial weight and target weight are all visible
  let minWeight = weights.length > 0 ? Math.min(...weights) : 0;
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 100;
  if (metrics.value?.initialWeight) {
    minWeight = Math.min(minWeight, metrics.value.initialWeight);
  }
  if (metrics.value?.targetWeight) {
    minWeight = Math.min(minWeight, metrics.value.targetWeight);
  }
  const range = Math.max(maxWeight - minWeight, 10);
  // Start at min weight minus 30% of range, rounded to nearest 5 for cleaner axis
  const yAxisMin = Math.floor((minWeight - range * 0.3) / 5) * 5;

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params) => {
        let result = `${params[0].name}<br/>`;
        params.forEach(param => {
          if (param.seriesName === t('weight.dailyAvgWeight')) {
            result += `${param.marker}${t('weight.dailyAvgWeight')}: ${param.value} ${t('weight.kg')}<br/>`;
          } else {
            result += `${param.marker}${param.seriesName}: ${param.value} ${t('weight.kg')}<br/>`;
          }
        });
        return result;
      }
    },
    legend: {
      data: legendData,
      right: 10,
      top: 0,
      textStyle: {
        color: textColor
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '18%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: {
        rotate: 30,
        fontSize: 11,
        color: textColor,
        margin: 8
      },
      axisLine: {
        lineStyle: {
          color: axisLineColor
        }
      }
    },
    yAxis: {
      type: 'value',
      name: `${t('weight.kg')}`,
      min: yAxisMin,
      nameTextStyle: {
        color: '#722ed1'
      },
      axisLabel: {
        color: '#722ed1',
        formatter: '{value} kg'
      },
      axisLine: {
        lineStyle: {
          color: '#722ed1'
        }
      },
      splitLine: {
        lineStyle: {
          color: splitLineColor
        }
      }
    },
    series
  };

  chartInstance.setOption(option, true);
};

watch(() => props.weightData, (newData) => {
  if (newData && chartInstance) {
    updateChart();
  }
}, { deep: true });

watch(() => localeStore.currentLocale, () => {
  if (chartInstance) updateChart();
});

watch(() => props.loading, async (newLoading) => {
  if (!newLoading && props.weightData && dailyData.value.length > 0) {
    await nextTick();
    setTimeout(() => {
      initChart();
    }, 100);
  }
});

onMounted(() => {
  if (!props.loading && props.weightData && dailyData.value.length > 0) {
    setTimeout(() => {
      initChart();
    }, 100);
  }
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
.chart-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  position: relative;
}

.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

/* Stats card */
.stats-card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  flex-shrink: 0;
}

.card-title {
  margin: 0 0 24px 0;
  font-size: 18px;
  color: var(--text-primary);
  font-weight: 600;
  text-align: left;
}

.chart-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
  text-align: left;
}

.stats-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.weight-stat-card {
  justify-content: flex-start;
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.08), rgba(114, 46, 209, 0.035));
  border: 1px solid rgba(114, 46, 209, 0.14);
  box-shadow: 0 1px 4px rgba(114, 46, 209, 0.05);
}

.weight-stat-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(114, 46, 209, 0.08);
  border-color: rgba(114, 46, 209, 0.2);
}

.weight-stat-card--purple {
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.09), rgba(114, 46, 209, 0.03));
}

.weight-stat-card--violet {
  background: linear-gradient(135deg, rgba(180, 150, 255, 0.14), rgba(180, 150, 255, 0.04));
  border-color: rgba(180, 150, 255, 0.22);
}

.weight-stat-card--orange {
  background: linear-gradient(135deg, rgba(250, 173, 20, 0.1), rgba(250, 173, 20, 0.035));
  border-color: rgba(250, 173, 20, 0.18);
}

.weight-stat-card--rose {
  background: linear-gradient(135deg, rgba(245, 108, 108, 0.08), rgba(245, 108, 108, 0.03));
  border-color: rgba(245, 108, 108, 0.16);
}

.weight-stat-card--blue {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.08), rgba(64, 158, 255, 0.03));
  border-color: rgba(64, 158, 255, 0.16);
}

.weight-stat-card--green {
  background: linear-gradient(135deg, rgba(103, 194, 58, 0.08), rgba(103, 194, 58, 0.03));
  border-color: rgba(103, 194, 58, 0.16);
}

.weight-stat-card :deep(.metric-card__header) {
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.weight-stat-card :deep(.metric-card__label-wrap) {
  gap: 8px;
}

.weight-stat-card :deep(.metric-card__label) {
  font-size: 12px;
  white-space: nowrap;
}

.weight-stat-card :deep(.metric-card__value) {
  text-align: left;
  white-space: nowrap;
  line-height: 1.15;
}

.stat-item {
  flex: 0 0 calc(33.333% - 8px);
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.08), rgba(114, 46, 209, 0.03));
  border-radius: 10px;
  border: 1px solid rgba(114, 46, 209, 0.15);
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  min-height: 80px;
}

.stat-item:hover {
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.12), rgba(114, 46, 209, 0.06));
  border-color: rgba(114, 46, 209, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 24px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.1), rgba(114, 46, 209, 0.05));
  border-radius: 10px;
  flex-shrink: 0;
}

.weight-stat-icon {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 22px;
  background: rgba(114, 46, 209, 0.12);
  color: #7e57c2;
  flex-shrink: 0;
}

.weight-stat-card--orange .weight-stat-icon {
  background: rgba(250, 173, 20, 0.14);
  color: #f59f00;
}

.weight-stat-card--rose .weight-stat-icon {
  background: rgba(245, 108, 108, 0.12);
  color: #f56c6c;
}

.weight-stat-card--blue .weight-stat-icon {
  background: rgba(64, 158, 255, 0.12);
  color: #409eff;
}

.weight-stat-card--green .weight-stat-icon {
  background: rgba(103, 194, 58, 0.12);
  color: #67c23a;
}

/* Weight change color classes */
.weight-down {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.1), rgba(82, 196, 26, 0.05)) !important;
}

.weight-up {
  background: linear-gradient(135deg, rgba(255, 77, 79, 0.1), rgba(255, 77, 79, 0.05)) !important;
}

.weight-same {
  background: linear-gradient(135deg, rgba(144, 147, 153, 0.1), rgba(144, 147, 153, 0.05)) !important;
}

.value-down {
  color: #52c41a !important;
}

.value-up {
  color: #ff4d4f !important;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary, #909399);
  line-height: 1.2;
  flex: 1;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #303133);
  line-height: 1.2;
}

.bmi-value-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.hw-date {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary, #909399);
  margin-left: 2px;
}

.stat-sub {
  font-size: 11px;
  color: var(--text-secondary, #909399);
  margin-top: 4px;
  line-height: 1.3;
}

.weight-change-icon {
  font-size: 22px;
}

.chart {
  width: 100%;
  flex: 1;
  min-height: 300px;
  overflow: hidden;
}

.skeleton-stats-card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  flex-shrink: 0;
}

.skeleton-chart-container {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.skeleton-title-text {
  width: 120px;
  height: 24px;
  background: linear-gradient(90deg, 
    var(--skeleton-color, #e0e0e0) 25%, 
    var(--skeleton-highlight, #f0f0f0) 50%, 
    var(--skeleton-color, #e0e0e0) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  margin-bottom: 24px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-title-text-small {
  width: 140px;
  height: 20px;
  background: linear-gradient(90deg, 
    var(--skeleton-color, #e0e0e0) 25%, 
    var(--skeleton-highlight, #f0f0f0) 50%, 
    var(--skeleton-color, #e0e0e0) 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  margin-bottom: 16px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-chart-area {
  flex: 1;
  min-height: 280px;
  background: linear-gradient(90deg, 
    var(--skeleton-color, #e0e0e0) 25%, 
    var(--skeleton-highlight, #f0f0f0) 50%, 
    var(--skeleton-color, #e0e0e0) 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.stat-item-skeleton {
  flex: 0 0 calc(33.333% - 8px);
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: var(--card-bg);
  border-radius: 10px;
  border: 1px solid var(--card-border);
  min-height: 80px;
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(90deg, 
    var(--skeleton-color, #e0e0e0) 25%, 
    var(--skeleton-highlight, #f0f0f0) 50%, 
    var(--skeleton-color, #e0e0e0) 75%);
  background-size: 200% 100%;
  border-radius: 10px;
  flex-shrink: 0;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

.skeleton-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.skeleton-label {
  width: 80%;
  height: 14px;
  background: linear-gradient(90deg, 
    var(--skeleton-color, #e0e0e0) 25%, 
    var(--skeleton-highlight, #f0f0f0) 50%, 
    var(--skeleton-color, #e0e0e0) 75%);
  background-size: 200% 100%;
  border-radius: 3px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  flex: 1;
}

.skeleton-value {
  width: 60%;
  height: 20px;
  background: linear-gradient(90deg, 
    var(--skeleton-color, #e0e0e0) 25%, 
    var(--skeleton-highlight, #f0f0f0) 50%, 
    var(--skeleton-color, #e0e0e0) 75%);
  background-size: 200% 100%;
  border-radius: 3px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Responsive breakpoints */
@media (max-width: 992px) {
  .stat-item {
    flex: 0 0 calc(50% - 6px);
  }
}

@media (max-width: 576px) {
  .stat-item {
    flex: 0 0 100%;
  }
  .stat-label {
    font-size: 11px;
  }
  .stat-value {
    font-size: 18px;
  }
  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
}

/* Dark theme adjustments */
:deep(.dark-theme) .stat-item {
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.15), rgba(114, 46, 209, 0.08));
  border-color: rgba(114, 46, 209, 0.25);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

:deep(.dark-theme) .stat-item:hover {
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.2), rgba(114, 46, 209, 0.12));
  border-color: rgba(114, 46, 209, 0.35);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

:deep(.dark-theme) .stat-icon {
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.2), rgba(114, 46, 209, 0.12));
}

:deep(.dark-theme) .skeleton-title-text,
:deep(.dark-theme) .skeleton-icon,
:deep(.dark-theme) .skeleton-label,
:deep(.dark-theme) .skeleton-value,
:deep(.dark-theme) .skeleton-title-text-small,
:deep(.dark-theme) .skeleton-chart-area {
  --skeleton-color: #3a3a3a;
  --skeleton-highlight: #4a4a4a;
}
</style>


