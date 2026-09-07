<template>
  <div class="chart-wrapper">
    <ChartLoadingSkeleton v-if="loading" :stat-count="6" :stat-columns="3" />
    <!-- Statistics cards card -->
    <div v-if="!loading && stats" class="stats-card">
      <SectionTitle>{{ t('chart.exerciseStats') }}</SectionTitle>
      <div class="chart-metrics-grid chart-metrics-grid--3">
        <MetricCard compact layout="row" class="steps-stat-card steps-stat-card--blue">
          <template #icon>⏱️</template>
          <template #label>{{ t('chart.avgExerciseDuration') }}</template>
          <template #badge>
            <el-tooltip :content="t('chart.avgExerciseDurationFormula') + '<br/>' + t('chart.description') + '：' + t('chart.avgExerciseDurationDesc')" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #value>{{ stats.avgExerciseDuration }} {{ t('chart.minutes') }}</template>
        </MetricCard>
        <MetricCard compact layout="row" class="steps-stat-card steps-stat-card--green">
          <template #icon>📏</template>
          <template #label>{{ t('chart.avgExerciseDistance') }}</template>
          <template #badge>
            <el-tooltip :content="t('chart.avgExerciseDistanceFormula') + '<br/>' + t('chart.description') + '：' + t('chart.avgExerciseDistanceDesc')" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #value>{{ stats.avgExerciseDistance }} km</template>
        </MetricCard>
        <MetricCard compact layout="row" class="steps-stat-card steps-stat-card--orange">
          <template #icon>🔥</template>
          <template #label>{{ t('chart.avgDailyCalories') }}</template>
          <template #badge>
            <el-tooltip :content="t('chart.avgDailyCaloriesFormula') + '<br/>' + t('chart.description') + '：' + t('chart.avgDailyCaloriesDesc')" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #value>{{ stats.avgDailyCalories }} kcal</template>
        </MetricCard>
        <MetricCard compact layout="row" class="steps-stat-card steps-stat-card--purple">
          <template #icon>🕐</template>
          <template #label>{{ t('chart.totalExerciseDuration') }}</template>
          <template #badge>
            <el-tooltip :content="t('chart.totalExerciseDurationFormula') + '<br/>' + t('chart.description') + '：' + t('chart.totalExerciseDurationDesc')" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #value>{{ stats.totalExerciseDuration }} {{ t('chart.hours') }}</template>
        </MetricCard>
        <MetricCard compact layout="row" class="steps-stat-card steps-stat-card--cyan">
          <template #icon>📍</template>
          <template #label>{{ t('chart.totalExerciseDistance') }}</template>
          <template #badge>
            <el-tooltip :content="t('chart.totalExerciseDistanceFormula') + '<br/>' + t('chart.description') + '：' + t('chart.totalExerciseDistanceDesc')" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #value>{{ stats.totalExerciseDistance }} km</template>
        </MetricCard>
        <MetricCard compact layout="row" class="steps-stat-card steps-stat-card--teal">
          <template #icon>📅</template>
          <template #label>{{ t('chart.exerciseDays') }}</template>
          <template #badge>
            <el-tooltip :content="t('chart.exerciseFrequencyFormula') + '<br/>' + t('chart.description') + '：' + t('chart.exerciseFrequencyDesc')" placement="top" raw-content>
              <el-icon class="help-icon"><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
          <template #value>{{ stats.actualExerciseDays }}/{{ stats.totalDays }} {{ t('chart.days') }}</template>
        </MetricCard>
      </div>
    </div>
    
    <!-- Chart card -->
    <ChartPanel
      v-show="!loading"
      :empty="!loading && data.length === 0"
      :empty-description="t('chart.noData')"
    >
      <template #title>
        <SectionTitle>{{ t('chart.stepsDistanceTrend') }}</SectionTitle>
      </template>
      <div ref="chartRef" class="chart"></div>
    </ChartPanel>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import * as echarts from 'echarts';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore.js';
import MetricCard from '../common/MetricCard.vue';
import ChartPanel from '../common/ChartPanel.vue';
import ChartLoadingSkeleton from '../common/ChartLoadingSkeleton.vue';

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const chartRef = ref(null);
let chartInstance = null;

// Calculate statistics
const stats = computed(() => {
  if (!props.data || props.data.length === 0) return null;
  
  // Filter days with exercise (totalDurationMinutes > 0)
  const exerciseDays = props.data.filter(item => item.totalDurationMinutes && item.totalDurationMinutes > 0);
  
  // Total days in selected range
  const totalDays = props.data.length;
  // Actual exercise days count
  const actualExerciseDays = exerciseDays.length;
  
  if (actualExerciseDays === 0) {
    return {
      avgExerciseDuration: 0,
      avgExerciseDistance: 0,
      actualExerciseDays: 0,
      totalDays: totalDays,
      totalExerciseDuration: 0,
      totalExerciseDistance: 0,
      avgDailyCalories: 0
    };
  }
  
  // Calculate average exercise duration (only for days with exercise)
  const totalDuration = exerciseDays.reduce((sum, item) => sum + (item.totalDurationMinutes || 0), 0);
  const avgExerciseDuration = Math.round(totalDuration / actualExerciseDays);
  
  // Calculate average exercise distance (only for days with exercise)
  const totalDistance = exerciseDays.reduce((sum, item) => sum + ((item.distance || 0) / 1000), 0);
  const avgExerciseDistance = (totalDistance / actualExerciseDays).toFixed(2);
  
  // Calculate total exercise duration and distance
  const totalExerciseDuration = (totalDuration / 60).toFixed(1); // Convert to hours
  const totalExerciseDistance = totalDistance.toFixed(2);
  
  // Calculate calories from sport_records data
  const totalSportCalories = exerciseDays.reduce((sum, item) => sum + (item.sportCalories || 0), 0);
  const avgDailyCalories = Math.round(totalSportCalories / actualExerciseDays);
  const totalCalories = Math.round(totalSportCalories);
  
  return {
    avgExerciseDuration,
    avgExerciseDistance,
    actualExerciseDays,
    totalDays,
    totalExerciseDuration,
    totalExerciseDistance,
    avgDailyCalories,
    totalCalories
  };
});

const initChart = () => {
  if (!chartRef.value) return;
  chartInstance = echarts.init(chartRef.value);
  updateChart();
};

const updateChart = () => {
  if (!chartInstance || props.data.length === 0) return;

  const dates = props.data.map(item => item.date);
  const steps = props.data.map(item => item.steps || 0);
  const distance = props.data.map(item => (item.distance || 0) / 1000); // Convert meters to km
  const exerciseDuration = props.data.map(item => item.totalDurationMinutes || 0);
  const sportCalories = props.data.map(item => item.sportCalories || 0);

  // Get theme colors
  const isDark = document.documentElement.classList.contains('dark-theme');
  const textColor = isDark ? '#a8a8a8' : '#606266';
  const axisLineColor = isDark ? '#3a3a3a' : '#e8e8e8';
  const splitLineColor = isDark ? '#3a3a3a' : '#ebeef5';

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params) => {
        let result = `${params[0].name}<br/>`;
        params.forEach(param => {
          if (param.seriesName === t('chart.steps')) {
            result += `${param.marker}${t('chart.steps')}: ${param.value.toLocaleString()} ${t('chart.unitSteps')}<br/>`;
          } else if (param.seriesName === t('chart.distance')) {
            result += `${param.marker}${t('chart.distance')}: ${param.value.toFixed(2)} km<br/>`;
          } else if (param.seriesName === t('chart.sportCalories')) {
            result += `${param.marker}${t('chart.sportCalories')}: ${param.value} kcal<br/>`;
          }
        });
        // Add exercise duration from the data point
        const dataIndex = params[0].dataIndex;
        const duration = exerciseDuration[dataIndex];
        const calories = sportCalories[dataIndex];
        if (duration > 0) {
          result += `🏃‍♂️ ${t('chart.totalExerciseDuration')}: ${duration} ${t('chart.minutes')}<br/>`;
        }
        if (calories > 0) {
          result += `🔥 ${t('chart.sportCalories')}: ${calories} kcal<br/>`;
        }
        return result;
      }
    },
    legend: {
      data: [t('chart.steps'), t('chart.distance'), t('chart.sportCalories')],
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
    yAxis: [
      {
        type: 'value',
        name: t('chart.steps'),
        position: 'left',
        nameTextStyle: {
          color: '#1890ff'
        },
        axisLabel: {
          color: '#1890ff',
          formatter: (value) => (value / 1000).toFixed(0) + 'k'
        },
        axisLine: {
          lineStyle: {
            color: '#1890ff'
          }
        },
        splitLine: {
          lineStyle: {
            color: splitLineColor
          }
        }
      },
      {
        type: 'value',
        name: `${t('chart.distance')}(km)`,
        position: 'right',
        nameTextStyle: {
          color: '#52c41a'
        },
        axisLabel: {
          color: '#52c41a',
          formatter: '{value} km'
        },
        axisLine: {
          lineStyle: {
            color: '#52c41a'
          }
        },
        splitLine: {
          show: false
        }
      }
    ],
    series: [
      {
        name: t('chart.steps'),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          color: '#1890ff',
          width: 2
        },
        itemStyle: {
          color: '#1890ff'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
          ])
        },
        data: steps
      },
      {
        name: t('chart.distance'),
        type: 'line',
        smooth: true,
        symbol: 'diamond',
        symbolSize: 8,
        yAxisIndex: 1,
        lineStyle: {
          color: '#52c41a',
          width: 2,
          type: 'dashed'
        },
        itemStyle: {
          color: '#52c41a'
        },
        data: distance
      }
    ]
  };

  chartInstance.setOption(option);
};

watch(() => props.data, (newData) => {
  // Update chart when data changes and chart is initialized
  if (newData && newData.length > 0 && chartInstance) {
    updateChart();
  }
}, { deep: true });

watch(() => localeStore.currentLocale, () => {
  if (chartInstance) updateChart();
});

// Watch for loading state changes to initialize chart when loading finishes
watch(() => props.loading, async (newLoading) => {
  if (!newLoading && props.data && props.data.length > 0) {
    await nextTick();
    setTimeout(() => {
      initChart();
    }, 100);
  }
});

onMounted(() => {
  // Initialize chart on mount if not loading and has data
  if (!props.loading && props.data && props.data.length > 0) {
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

.steps-stat-card {
  justify-content: flex-start;
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.08), rgba(24, 144, 255, 0.03));
  border: 1px solid rgba(24, 144, 255, 0.15);
  box-shadow: 0 1px 4px rgba(24, 144, 255, 0.05);
}

.steps-stat-card:hover {
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.12), rgba(24, 144, 255, 0.06));
  border-color: rgba(24, 144, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.steps-stat-card--blue {
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.08), rgba(24, 144, 255, 0.03));
}

.steps-stat-card--green {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.08), rgba(82, 196, 26, 0.03));
  border-color: rgba(82, 196, 26, 0.15);
}

.steps-stat-card--orange {
  background: linear-gradient(135deg, rgba(250, 140, 22, 0.08), rgba(250, 140, 22, 0.03));
  border-color: rgba(250, 140, 22, 0.15);
}

.steps-stat-card--purple {
  background: linear-gradient(135deg, rgba(114, 46, 209, 0.08), rgba(114, 46, 209, 0.03));
  border-color: rgba(114, 46, 209, 0.15);
}

.steps-stat-card--cyan {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.08), rgba(64, 158, 255, 0.03));
  border-color: rgba(64, 158, 255, 0.15);
}

.steps-stat-card--teal {
  background: linear-gradient(135deg, rgba(19, 206, 102, 0.08), rgba(19, 206, 102, 0.03));
  border-color: rgba(19, 206, 102, 0.15);
}

.steps-stat-card :deep(.metric-card__header) {
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.steps-stat-card :deep(.metric-card__label-wrap) {
  gap: 8px;
}

.steps-stat-card :deep(.metric-card__label) {
  font-size: 12px;
  white-space: nowrap;
}

.steps-stat-card :deep(.metric-card__value) {
  text-align: left;
  white-space: nowrap;
  line-height: 1.15;
}

.chart-container {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  overflow: hidden;
  flex: 1;
  height: 100%; /* Use full height to match sidebar */
  display: flex;
  flex-direction: column;
}

.chart {
  width: 100%;
  flex: 1; /* Take remaining space */
  min-height: 300px;
  overflow: hidden;
}

/* Dark theme adjustments */
:deep(.dark-theme) .stat-item {
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.15), rgba(24, 144, 255, 0.08));
  border-color: rgba(24, 144, 255, 0.25);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

:deep(.dark-theme) .stat-item:hover {
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.2), rgba(24, 144, 255, 0.12));
  border-color: rgba(24, 144, 255, 0.35);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}

:deep(.dark-theme) .stat-icon {
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.2), rgba(24, 144, 255, 0.12));
}

/* Dark theme skeleton styles */
:deep(.dark-theme) .skeleton-title,
:deep(.dark-theme) .skeleton-icon,
:deep(.dark-theme) .skeleton-label,
:deep(.dark-theme) .skeleton-value,
:deep(.dark-theme) .skeleton-title-small,
:deep(.dark-theme) .skeleton-chart-area {
  --skeleton-color: #3a3a3a;
  --skeleton-highlight: #4a4a4a;
}
</style>



