<template>
  <div class="chart-wrapper">
    <!-- Skeleton loading state -->
    <div v-show="loading" class="skeleton-wrapper">
      <!-- Stats card skeleton -->
      <div class="stats-card skeleton-stats-card">
        <div class="skeleton-title-text"></div>
        <div class="stats-cards">
          <div v-for="i in 6" :key="i" class="stat-item-skeleton">
            <div class="skeleton-icon"></div>
            <div class="skeleton-content">
              <div class="skeleton-header">
                <div class="skeleton-label"></div>
                <div class="skeleton-help-icon"></div>
              </div>
              <div class="skeleton-value"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Chart container skeleton -->
      <div class="chart-container skeleton-chart-container">
        <div class="skeleton-title-text-small"></div>
        <div class="skeleton-chart-area"></div>
      </div>
    </div>
    
    <!-- Statistics cards card -->
    <div v-if="!loading && stats" class="stats-card">
      <h3 class="card-title">{{ t('chart.exerciseStats') }}</h3>
      <div class="stats-cards">
        <div class="stat-item">
          <div class="stat-icon">⏱️</div>
          <div class="stat-content">
            <div class="stat-header">
              <span class="stat-label">{{ t('chart.avgExerciseDuration') }}</span>
              <el-tooltip :content="t('chart.avgExerciseDurationFormula') + '<br/>' + t('chart.description') + '：' + t('chart.avgExerciseDurationDesc')" placement="top" raw-content>
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="stat-value">{{ stats.avgExerciseDuration }} {{ t('chart.minutes') }}</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">📏</div>
          <div class="stat-content">
            <div class="stat-header">
              <span class="stat-label">{{ t('chart.avgExerciseDistance') }}</span>
              <el-tooltip :content="t('chart.avgExerciseDistanceFormula') + '<br/>' + t('chart.description') + '：' + t('chart.avgExerciseDistanceDesc')" placement="top" raw-content>
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="stat-value">{{ stats.avgExerciseDistance }} km</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">🔥</div>
          <div class="stat-content">
            <div class="stat-header">
              <span class="stat-label">{{ t('chart.avgDailyCalories') }}</span>
              <el-tooltip :content="t('chart.avgDailyCaloriesFormula') + '<br/>' + t('chart.description') + '：' + t('chart.avgDailyCaloriesDesc')" placement="top" raw-content>
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="stat-value">{{ stats.avgDailyCalories }} kcal</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">🕐</div>
          <div class="stat-content">
            <div class="stat-header">
              <span class="stat-label">{{ t('chart.totalExerciseDuration') }}</span>
              <el-tooltip :content="t('chart.totalExerciseDurationFormula') + '<br/>' + t('chart.description') + '：' + t('chart.totalExerciseDurationDesc')" placement="top" raw-content>
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="stat-value">{{ stats.totalExerciseDuration }} {{ t('chart.hours') }}</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">📍</div>
          <div class="stat-content">
            <div class="stat-header">
              <span class="stat-label">{{ t('chart.totalExerciseDistance') }}</span>
              <el-tooltip :content="t('chart.totalExerciseDistanceFormula') + '<br/>' + t('chart.description') + '：' + t('chart.totalExerciseDistanceDesc')" placement="top" raw-content>
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="stat-value">{{ stats.totalExerciseDistance }} km</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <div class="stat-header">
              <span class="stat-label">{{ t('chart.exerciseDays') }}</span>
              <el-tooltip :content="t('chart.exerciseFrequencyFormula') + '<br/>' + t('chart.description') + '：' + t('chart.exerciseFrequencyDesc')" placement="top" raw-content>
                <el-icon class="help-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
            <div class="stat-value">{{ stats.actualExerciseDays }}/{{ stats.totalDays }} {{ t('chart.days') }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Chart card -->
    <div v-show="!loading" class="chart-container">
      <h3 class="chart-title">{{ t('chart.stepsDistanceTrend') }}</h3>
      <div ref="chartRef" class="chart"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import * as echarts from 'echarts';
import { QuestionFilled } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore.js';

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

.stats-card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  flex-shrink: 0;
}

.skeleton-chart {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

/* Skeleton stats card styles */
.skeleton-stats-card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--card-border);
  flex-shrink: 0;
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

.skeleton-help-icon {
  width: 14px;
  height: 14px;
  background: linear-gradient(90deg, 
    var(--skeleton-color, #e0e0e0) 25%, 
    var(--skeleton-highlight, #f0f0f0) 50%, 
    var(--skeleton-color, #e0e0e0) 75%);
  background-size: 200% 100%;
  border-radius: 50%;
  flex-shrink: 0;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
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

/* Skeleton chart container styles */
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

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
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

.stat-item {
  flex: 0 0 calc(33.333% - 8px);
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.08), rgba(24, 144, 255, 0.03));
  border-radius: 10px;
  border: 1px solid rgba(24, 144, 255, 0.15);
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  min-height: 80px;
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
    font-size: 24px;
  }
}

.stat-item:hover {
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.12), rgba(24, 144, 255, 0.06));
  border-color: rgba(24, 144, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.1), rgba(24, 144, 255, 0.05));
  border-radius: 10px;
  flex-shrink: 0;
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

.help-icon {
  font-size: 14px;
  color: var(--text-secondary, #909399);
  cursor: help;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.help-icon:hover {
  color: var(--primary-color, #1890ff);
  transform: scale(1.1);
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
