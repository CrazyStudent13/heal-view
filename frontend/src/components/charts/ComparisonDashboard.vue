<template>
  <div class="comparison-dashboard">
    <!-- Summary comparison cards -->
    <div class="summary-cards" v-if="comparisonData.length > 0">
      <div class="card">
        <div class="card-icon steps">📊</div>
        <div class="card-content">
          <div class="card-label">{{ t('data.avgSteps') }}</div>
          <div class="card-value">{{ formatNumber(avgSteps) }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon calories">🔥</div>
        <div class="card-content">
          <div class="card-label">{{ t('data.avgCalories') }}</div>
          <div class="card-value">{{ formatNumber(avgCalories) }} kcal</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon heartrate">❤️</div>
        <div class="card-content">
          <div class="card-label">{{ t('data.heartRate') }}</div>
          <div class="card-value">{{ avgHeartRate }} bpm</div>
        </div>
      </div>

      <div class="card">
        <div class="card-icon max">🏆</div>
        <div class="card-content">
          <div class="card-label">{{ t('data.maxSteps') }}</div>
          <div class="card-value">{{ formatNumber(maxSteps) }}</div>
        </div>
      </div>
    </div>

    <!-- Comparison charts -->
    <ComparisonChart v-if="comparisonData.length > 0" :data="comparisonData" />

    <!-- Empty state -->
    <div v-if="selectedDates.length === 0" class="empty-state">
      <p>{{ t('nav.selectDatesToCompare') }}</p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <p>{{ t('common.loading') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';
import { useLocaleStore } from '../../stores/localeStore.js';
import ComparisonChart from './ComparisonChart.vue';

const localeStore = useLocaleStore();
const { t } = localeStore;

const dateStore = useDateStore();
const dataStore = useDataStore();

const comparisonData = ref([]);
const loading = ref(false);

// Computed values
const selectedDates = computed(() => dateStore.selectedDates);

const avgSteps = computed(() => {
  if (comparisonData.value.length === 0) return 0;
  const sum = comparisonData.value.reduce((acc, item) => acc + item.steps, 0);
  return Math.round(sum / comparisonData.value.length);
});

const avgCalories = computed(() => {
  if (comparisonData.value.length === 0) return 0;
  const sum = comparisonData.value.reduce((acc, item) => acc + item.calories, 0);
  return Math.round(sum / comparisonData.value.length);
});

const avgHeartRate = computed(() => {
  if (comparisonData.value.length === 0) return 0;
  const sum = comparisonData.value.reduce((acc, item) => acc + item.avgHeartRate, 0);
  return Math.round(sum / comparisonData.value.length);
});

const maxSteps = computed(() => {
  if (comparisonData.value.length === 0) return 0;
  return Math.max(...comparisonData.value.map(item => item.steps));
});

// Format number with commas
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Fetch data when selected dates change
watch(() => dateStore.selectedDates, async (newDates) => {
  if (newDates.length === 0) {
    comparisonData.value = [];
    return;
  }

  loading.value = true;
  
  try {
    const data = [];
    for (const date of newDates) {
      const summary = await dataStore.fetchDailySummary(date);
      if (summary) {
        data.push(summary);
      }
    }
    // Sort by date ascending
    comparisonData.value = data.sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (error) {
    console.error('Failed to fetch comparison data:', error);
  } finally {
    loading.value = false;
  }
}, { deep: true });
</script>

<style scoped>
.comparison-dashboard {
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

.card-icon.max {
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

.empty-state, .loading-state {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
