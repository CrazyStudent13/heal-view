<template>
  <div class="chart-wrapper">
    <!-- Skeleton loading state -->
    <div v-show="loading" class="skeleton-overlay">
      <div class="stats-card">
        <h3 class="card-title">运动统计</h3>
        <div class="stats-cards">
          <el-skeleton-item 
            v-for="i in 6" 
            :key="i"
            variant="rect" 
            style="width: calc(33.333% - 8px); height: 80px; border-radius: 10px;" 
          />
        </div>
      </div>
      <div class="chart-container skeleton-chart">
        <h3 class="card-title">步数与距离趋势</h3>
        <el-skeleton animated>
          <template #default>
            <el-skeleton-item variant="rect" style="width: 100%; height: 100%;" />
          </template>
        </el-skeleton>
      </div>
    </div>
    
    <!-- Statistics cards card -->
    <div v-if="!loading && stats" class="stats-card">
      <h3 class="card-title">运动统计</h3>
      <div class="stats-cards">
        <div class="stat-item">
          <div class="stat-icon">🏃‍️</div>
          <div class="stat-content">
            <div class="stat-label">平均日运动时长</div>
            <div class="stat-value">{{ stats.avgExerciseDuration }} 分钟</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">📏</div>
          <div class="stat-content">
            <div class="stat-label">平均日运动距离</div>
            <div class="stat-value">{{ stats.avgExerciseDistance }} km</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">🔥</div>
          <div class="stat-content">
            <div class="stat-label">日平均热量</div>
            <div class="stat-value">{{ stats.avgDailyCalories }} kcal</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">⏱️</div>
          <div class="stat-content">
            <div class="stat-label">累计运动时长</div>
            <div class="stat-value">{{ stats.totalExerciseDuration }} 小时</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">📍</div>
          <div class="stat-content">
            <div class="stat-label">累计运动距离</div>
            <div class="stat-value">{{ stats.totalExerciseDistance }} km</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <div class="stat-label">周运动天数</div>
            <div class="stat-value">{{ stats.weeklyExerciseDays }} 天</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Chart card -->
    <div class="chart-container">
      <h3 class="chart-title">步数与距离趋势</h3>
      <div ref="chartRef" class="chart"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import * as echarts from 'echarts';

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
  
  if (exerciseDays.length === 0) {
    return {
      avgExerciseDuration: 0,
      avgExerciseDistance: 0,
      weeklyExerciseDays: 0,
      totalExerciseDuration: 0,
      totalExerciseDistance: 0,
      avgDailyCalories: 0
    };
  }
  
  // Calculate average exercise duration (only for days with exercise)
  const totalDuration = exerciseDays.reduce((sum, item) => sum + (item.totalDurationMinutes || 0), 0);
  const avgExerciseDuration = Math.round(totalDuration / exerciseDays.length);
  
  // Calculate average exercise distance (only for days with exercise)
  const totalDistance = exerciseDays.reduce((sum, item) => sum + ((item.distance || 0) / 1000), 0);
  const avgExerciseDistance = (totalDistance / exerciseDays.length).toFixed(2);
  
  // Calculate weekly exercise days (count unique weeks with at least one exercise day)
  const weeksWithExercise = new Set();
  exerciseDays.forEach(item => {
    const date = new Date(item.date);
    // Get ISO week number
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayOfWeek);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    weeksWithExercise.add(`${year}-W${weekNum}`);
  });
  const weeklyExerciseDays = weeksWithExercise.size;
  
  // Calculate total exercise duration and distance
  const totalExerciseDuration = (totalDuration / 60).toFixed(1); // Convert to hours
  const totalExerciseDistance = totalDistance.toFixed(2);
  
  // Calculate calories from sport_records data
  const totalSportCalories = exerciseDays.reduce((sum, item) => sum + (item.sportCalories || 0), 0);
  const avgDailyCalories = Math.round(totalSportCalories / exerciseDays.length);
  const totalCalories = Math.round(totalSportCalories);
  
  return {
    avgExerciseDuration,
    avgExerciseDistance,
    weeklyExerciseDays,
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
          if (param.seriesName === '步数') {
            result += `${param.marker}${param.seriesName}: ${param.value.toLocaleString()} 步<br/>`;
          } else if (param.seriesName === '距离') {
            result += `${param.marker}${param.seriesName}: ${param.value.toFixed(2)} km<br/>`;
          } else if (param.seriesName === '运动热量') {
            result += `${param.marker}${param.seriesName}: ${param.value} kcal<br/>`;
          }
        });
        // Add exercise duration from the data point
        const dataIndex = params[0].dataIndex;
        const duration = exerciseDuration[dataIndex];
        const calories = sportCalories[dataIndex];
        if (duration > 0) {
          result += `🏃‍♂️ 运动时长: ${duration} 分钟<br/>`;
        }
        if (calories > 0) {
          result += `🔥 运动热量: ${calories} kcal<br/>`;
        }
        return result;
      }
    },
    legend: {
      data: ['步数', '距离', '运动热量'],
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
        name: '步数',
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
        name: '距离(km)',
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
        name: '步数',
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
        name: '距离',
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

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

// Watch for loading state changes to reinitialize chart
watch(() => props.loading, async (newLoading) => {
  if (!newLoading && chartRef.value) {
    // Wait for DOM to be updated
    await nextTick();
    setTimeout(() => {
      initChart();
    }, 100);
  }
});

onMounted(() => {
  if (!props.loading) {
    initChart();
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

.skeleton-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--card-bg);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 8px;
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

.stat-label {
  font-size: 12px;
  color: var(--text-secondary, #909399);
  margin-bottom: 6px;
  line-height: 1.2;
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
  min-height: 350px;
  max-height: calc(100vh - 280px);
  display: flex;
  flex-direction: column;
}

.chart {
  width: 100%;
  height: 100%;
  min-height: 280px;
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
</style>
