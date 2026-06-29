<template>
  <div class="unified-dashboard">
    <!-- Summary Cards - Clickable to switch chart type -->
    <div class="summary-cards" v-if="hasData">
      <div 
        class="card clickable" 
        :class="{ active: currentChartType === 'steps' }"
        @click="currentChartType = 'steps'"
      >
        <div class="card-icon steps">👟</div>
        <div class="card-content">
          <div class="card-label">{{ isCompareMode ? '平均步数' : '步数' }}</div>
          <div class="card-value">{{ formatNumber(displayData.avgSteps) }}</div>
        </div>
      </div>

      <div 
        class="card clickable" 
        :class="{ active: currentChartType === 'calories' }"
        @click="currentChartType = 'calories'"
      >
        <div class="card-icon calories">🔥</div>
        <div class="card-content">
          <div class="card-label">{{ isCompareMode ? '平均卡路里' : '卡路里' }}</div>
          <div class="card-value">{{ formatNumber(displayData.avgCalories) }} kcal</div>
        </div>
      </div>

      <div 
        class="card clickable" 
        :class="{ active: currentChartType === 'heartrate' }"
        @click="currentChartType = 'heartrate'"
      >
        <div class="card-icon heartrate">❤️</div>
        <div class="card-content">
          <div class="card-label">{{ isCompareMode ? '平均心率' : '平均心率' }}</div>
          <div class="card-value">{{ displayData.avgHeartRate }} bpm</div>
        </div>
      </div>

      <div 
        class="card clickable" 
        :class="{ active: currentChartType === 'stress' }"
        @click="currentChartType = 'stress'"
      >
        <div class="card-icon stress">😌</div>
        <div class="card-content">
          <div class="card-label">{{ isCompareMode ? '平均压力' : '压力指数' }}</div>
          <div class="card-value">{{ displayData.avgStress }}</div>
        </div>
      </div>
    </div>

    <!-- Dynamic Chart based on selected type -->
    <div v-if="hasData" class="chart-section">
      <StepsChart v-if="currentChartType === 'steps'" :data="chartData" />
      <CaloriesChart v-if="currentChartType === 'calories'" :data="chartData" />
      <HeartRateChart v-if="currentChartType === 'heartrate'" :data="chartData" />
      <StressChart v-if="currentChartType === 'stress'" :data="chartData" />
    </div>

    <!-- Empty state -->
    <div v-if="!hasData && !loading" class="empty-state">
      <p v-if="isCompareMode">请在左侧选择要对比的日期</p>
      <p v-else>请选择日期查看数据</p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';
import StepsChart from './StepsChart.vue';
import CaloriesChart from './CaloriesChart.vue';
import HeartRateChart from './HeartRateChart.vue';
import StressChart from './StressChart.vue';

const props = defineProps({
  viewMode: {
    type: String,
    default: 'single',
    validator: (value) => ['single', 'compare'].includes(value)
  }
});

const dateStore = useDateStore();
const dataStore = useDataStore();

const chartData = ref([]);
const loading = ref(false);
const currentChartType = ref('steps'); // Default to steps chart

// Check if in compare mode
const isCompareMode = computed(() => props.viewMode === 'compare');

// Check if has data
const hasData = computed(() => {
  if (isCompareMode.value) {
    return chartData.value.length > 0;
  } else {
    return chartData.value.length > 0 && chartData.value[0].steps !== undefined;
  }
});

// Calculate display data based on mode
const displayData = computed(() => {
  if (chartData.value.length === 0) {
    return { avgSteps: 0, avgCalories: 0, avgHeartRate: 0, avgStress: 0 };
  }

  if (isCompareMode.value) {
    // Multi-day comparison: calculate averages
    const avgSteps = Math.round(chartData.value.reduce((acc, item) => acc + item.steps, 0) / chartData.value.length);
    const avgCalories = Math.round(chartData.value.reduce((acc, item) => acc + item.calories, 0) / chartData.value.length);
    const avgHeartRate = Math.round(chartData.value.reduce((acc, item) => acc + item.avgHeartRate, 0) / chartData.value.length);
    const avgStress = Math.round(chartData.value.reduce((acc, item) => acc + item.avgStress, 0) / chartData.value.length);

    return { avgSteps, avgCalories, avgHeartRate, avgStress };
  } else {
    // Single day: use the first (and only) item
    const item = chartData.value[0];
    return {
      avgSteps: item.steps || 0,
      avgCalories: item.calories || 0,
      avgHeartRate: item.avgHeartRate || 0,
      avgStress: item.avgStress || 0
    };
  }
});

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Fetch data for single day mode
async function fetchSingleDayData(date) {
  if (!date) {
    chartData.value = [];
    return;
  }

  loading.value = true;
  try {
    const summary = await dataStore.fetchDailySummary(date);
    if (summary) {
      chartData.value = [{
        date: summary.date,
        steps: summary.steps,
        calories: summary.calories,
        avgHeartRate: summary.avgHeartRate,
        maxHeartRate: summary.maxHeartRate,
        avgStress: summary.avgStress
      }];
    } else {
      chartData.value = [];
    }
  } catch (error) {
    console.error('Failed to fetch single day data:', error);
    chartData.value = [];
  } finally {
    loading.value = false;
  }
}

// Fetch data for compare mode
async function fetchCompareData(dates) {
  if (dates.length === 0) {
    chartData.value = [];
    return;
  }

  loading.value = true;
  try {
    const data = [];
    for (const date of dates) {
      const summary = await dataStore.fetchDailySummary(date);
      if (summary) {
        data.push(summary);
      }
    }
    // Sort by date ascending
    chartData.value = data.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (error) {
    console.error('Failed to fetch compare data:', error);
    chartData.value = [];
  } finally {
    loading.value = false;
  }
}

// Watch for changes in single mode
watch(() => dateStore.selectedDate, async (newDate) => {
  if (props.viewMode === 'single') {
    currentChartType.value = 'steps'; // Reset to steps when switching dates
    await fetchSingleDayData(newDate);
  }
}, { immediate: true });

// Watch for changes in compare mode
watch(() => dateStore.selectedDates, async (newDates) => {
  if (props.viewMode === 'compare') {
    currentChartType.value = 'steps'; // Reset to steps when switching selection
    await fetchCompareData(newDates);
  }
}, { deep: true });

// Watch for view mode changes
watch(() => props.viewMode, () => {
  currentChartType.value = 'steps'; // Reset chart type when switching modes
});
</script>

<style scoped>
.unified-dashboard {
  padding: 20px;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.card {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.2s;
}

.card.clickable {
  cursor: pointer;
}

.card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card.clickable.active {
  border: 2px solid #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.2);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.card-icon.steps {
  background: #e6f7ff;
}

.card-icon.calories {
  background: #f6ffed;
}

.card-icon.heartrate {
  background: #fff1f0;
}

.card-icon.stress {
  background: #f9f0ff;
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.card-value {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.chart-section {
  margin-top: 20px;
}

.empty-state, .loading-state {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
