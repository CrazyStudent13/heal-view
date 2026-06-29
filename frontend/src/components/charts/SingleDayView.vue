<template>
  <div class="single-day-view">
    <!-- Summary Cards -->
    <div class="summary-cards" v-if="currentSummary">
      <div class="card">
        <div class="card-icon steps">👟</div>
        <div class="card-content">
          <div class="card-label">步数</div>
          <div class="card-value">{{ formatNumber(currentSummary.steps) }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon calories">🔥</div>
        <div class="card-content">
          <div class="card-label">卡路里</div>
          <div class="card-value">{{ formatNumber(currentSummary.calories) }} kcal</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon heartrate">❤️</div>
        <div class="card-content">
          <div class="card-label">平均心率</div>
          <div class="card-value">{{ currentSummary.avgHeartRate }} bpm</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon stress">😌</div>
        <div class="card-content">
          <div class="card-label">压力指数</div>
          <div class="card-value">{{ currentSummary.avgStress }}</div>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <StepsChart v-if="chartData.length > 0" :data="chartData" />
    <CaloriesChart v-if="chartData.length > 0" :data="chartData" />
    <HeartRateChart v-if="chartData.length > 0" :data="chartData" />

    <!-- Loading State -->
    <div v-if="dataStore.loading" class="loading-state">
      <p>加载中...</p>
    </div>

    <!-- Empty State -->
    <div v-if="!currentSummary && !dataStore.loading" class="empty-state">
      <p>请选择日期查看数据</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';
import StepsChart from './StepsChart.vue';
import CaloriesChart from './CaloriesChart.vue';
import HeartRateChart from './HeartRateChart.vue';

const dateStore = useDateStore();
const dataStore = useDataStore();

const chartData = ref([]);
const currentSummary = ref(null);

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Fetch data when selected date changes
watch(() => dateStore.selectedDate, async (newDate) => {
  if (!newDate) return;

  // Fetch daily summary
  const summary = await dataStore.fetchDailySummary(newDate);
  currentSummary.value = summary;

  // For now, we'll show the single day data
  // In the future, we can fetch a range of dates
  if (summary) {
    chartData.value = [{
      date: summary.date,
      steps: summary.steps,
      calories: summary.calories,
      avgHeartRate: summary.avgHeartRate,
      maxHeartRate: summary.maxHeartRate
    }];
  }
}, { immediate: true });
</script>

<style scoped>
.single-day-view {
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
  transition: transform 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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

.loading-state, .empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
