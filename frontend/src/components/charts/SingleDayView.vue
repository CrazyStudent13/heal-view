<template>
  <div class="single-day-view">
    <!-- Summary Cards -->
    <div class="summary-cards" v-if="currentSummary">
      <div class="card">
        <div class="card-icon steps">👟</div>
        <div class="card-content">
          <div class="card-label">{{ t('data.steps') }}</div>
          <div class="card-value">{{ formatNumber(currentSummary.steps) }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon calories">🔥</div>
        <div class="card-content">
          <div class="card-label">{{ t('data.calories') }}</div>
          <div class="card-value">{{ formatNumber(currentSummary.calories) }} kcal</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon heartrate">❤️</div>
        <div class="card-content">
          <div class="card-label">{{ t('data.heartRate') }}</div>
          <div class="card-value">{{ currentSummary.avgHeartRate }} bpm</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon stress">😌</div>
        <div class="card-content">
          <div class="card-label">{{ t('data.stress') }}</div>
          <div class="card-value">{{ currentSummary.avgStress }}</div>
        </div>
      </div>
    </div>

    <!-- Time Series Chart -->
    <TimeSeriesChart 
      v-if="timeSeriesLoaded" 
      :steps-data="stepsTimeSeries" 
      :heart-rate-data="heartRateTimeSeries" 
    />

    <!-- Loading State -->
    <div v-if="dataStore.loading" class="loading-state">
      <p>{{ t('common.loading') }}</p>
    </div>

    <!-- Empty State -->
    <div v-if="!currentSummary && !dataStore.loading" class="empty-state">
      <p>{{ t('nav.selectDateToView') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';
import { useLocaleStore } from '../../stores/localeStore.js';
import TimeSeriesChart from './TimeSeriesChart.vue';

const dateStore = useDateStore();
const dataStore = useDataStore();
const localeStore = useLocaleStore();
const { t } = localeStore;

const currentSummary = ref(null);
const timeSeriesLoaded = ref(false);
const stepsTimeSeries = ref([]);
const heartRateTimeSeries = ref([]);

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Fetch data when selected date changes
watch(() => dateStore.selectedDate, async (newDate) => {
  if (!newDate) return;

  // Reset state
  currentSummary.value = null;
  timeSeriesLoaded.value = false;
  stepsTimeSeries.value = [];
  heartRateTimeSeries.value = [];

  // Fetch daily summary
  const summary = await dataStore.fetchDailySummary(newDate);
  currentSummary.value = summary;

  // Fetch time series data for steps and heart rate
  if (summary) {
    try {
      const [stepsData, hrData] = await Promise.all([
        dataStore.fetchTimeSeries(newDate, 'steps'),
        dataStore.fetchTimeSeries(newDate, 'heart_rate')
      ]);

      if (stepsData) {
        stepsTimeSeries.value = stepsData.data || [];
      }

      if (hrData) {
        heartRateTimeSeries.value = hrData.data || [];
      }

      timeSeriesLoaded.value = true;
    } catch (error) {
      console.error('Failed to fetch time series data:', error);
      timeSeriesLoaded.value = true; // Still show the chart even if data is empty
    }
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
