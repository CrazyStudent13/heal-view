<template>
  <div class="app-layout">
    <!-- Top navigation bar -->
    <TopNavbar 
      v-model:viewMode="viewMode" 
      @open-settings="settingsDrawerVisible = true"
    />
    
    <!-- Settings Drawer -->
    <el-drawer
      v-model="settingsDrawerVisible"
      :title="t('settings.title')"
      direction="rtl"
      size="400px"
    >
      <div class="drawer-content">
        <!-- Language setting -->
        <div class="setting-item">
          <span class="icon-emoji">🌐</span>
          <span class="setting-label">{{ t('settings.language') }}</span>
          <el-select v-model="currentLanguage" size="default" style="width: 140px; margin-left: auto;">
            <el-option label="中文" value="zh-CN" />
            <el-option label="English" value="en" />
          </el-select>
        </div>

        <!-- Theme setting -->
        <div class="setting-item">
          <span class="icon-emoji">{{ isDarkMode ? '' : '☀️' }}</span>
          <span class="setting-label">{{ t('settings.theme') }}</span>
          <el-switch
            v-model="isDarkMode"
            inline-prompt
            active-text="暗"
            inactive-text="亮"
            size="default"
            style="margin-left: auto;"
          />
        </div>
      </div>
    </el-drawer>
    
    <!-- Main content area -->
    <div class="content-area">
      <!-- Left sidebar: Data cards -->
      <div class="sidebar-wrapper">
        <DataCardsSidebar 
          :chart-data="chartData"
          :current-chart-type="currentChartType"
          :view-mode="viewMode"
          :loading="loading"
          @chart-change="handleChartChange"
        />
      </div>
      
      <!-- Right area: Chart display -->
      <div class="chart-area">
        <ChartDisplay 
          :chart-data="chartData"
          :chart-type="currentChartType"
          :view-mode="viewMode"
          :loading="loading"
          :sleep-timeline-data="sleepTimelineData"
          :weight-data="weightData"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useDataStore } from '../../stores/dataStore.js';
import { useLocaleStore } from '../../stores/localeStore';
import { useThemeStore } from '../../stores/themeStore';
import TopNavbar from '../navigation/TopNavbar.vue';
import DataCardsSidebar from '../charts/DataCardsSidebar.vue';
import ChartDisplay from '../charts/ChartDisplay.vue';

const localeStore = useLocaleStore();
const themeStore = useThemeStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

// Settings drawer visibility
const settingsDrawerVisible = ref(false);

// Language - use store value
const currentLanguage = computed({
  get: () => localeStore.currentLocale === 'zh-CN' ? 'zh-CN' : 'en',
  set: (val) => localeStore.setLocale(val)
});

// Theme - use store value
const isDarkMode = computed({
  get: () => themeStore.isDarkMode,
  set: (val) => themeStore.setTheme(val)
});

const viewMode = ref('single'); // Default to single day mode for debugging
const currentChartType = ref('sport'); // Default to sport records in single mode
const chartData = ref([]);
const sleepTimelineData = ref(null);
const weightData = ref(null);
const loading = ref(false);

const dateStore = useDateStore();
const dataStore = useDataStore();

// Handle chart type change
async function handleChartChange(type) {
  currentChartType.value = type;
  
  // Fetch sleep timeline when switching to sleep chart in single mode
  if (type === 'sleep' && viewMode.value === 'single' && dateStore.selectedDate) {
    sleepTimelineData.value = await dataStore.fetchSleepTimeline(dateStore.selectedDate);
  } else if (type !== 'sleep') {
    sleepTimelineData.value = null;
  }
  
  // Fetch weight data when switching to weight chart in compare mode
  if (type === 'weight' && viewMode.value === 'compare') {
    await fetchWeightData();
  }
}

// Fetch data for single mode
async function fetchSingleDayData(date) {
  if (!date) {
    chartData.value = [];
    return;
  }

  loading.value = true;
  const summary = await dataStore.fetchDailySummary(date);
  if (summary) {
    chartData.value = [{
      date: summary.date,
      steps: summary.steps,
      distance: summary.distance,
      calories: summary.calories,
      avgHeartRate: summary.avgHeartRate,
      maxHeartRate: summary.maxHeartRate,
      avgStress: summary.avgStress,
      sleepHours: summary.sleepHours || 0,
      deepSleepHours: summary.deepSleepHours || 0,
      lightSleepHours: summary.lightSleepHours || 0,
      remSleepHours: summary.remSleepHours || 0,
      totalDurationMinutes: summary.totalDurationMinutes || 0,
      sportCalories: summary.sportCalories || 0
    }];
  } else {
    chartData.value = [];
  }
  loading.value = false;
}

// Fetch data for compare mode
async function fetchCompareData(dates) {
  if (dates.length === 0) {
    chartData.value = [];
    return;
  }

  loading.value = true;
  const data = [];
  for (const date of dates) {
    const summary = await dataStore.fetchDailySummary(date);
    if (summary) {
      data.push(summary);
    }
  }
  chartData.value = data.sort((a, b) => new Date(a.date) - new Date(b.date));
  loading.value = false;
  
  // Async fetch weight data for sidebar card display (don't block loading)
  fetchWeightDataForSidebar(dates);
}

// Fetch weight data only for sidebar display (no loading state change)
async function fetchWeightDataForSidebar(dates) {
  if (dates.length === 0) return;
  
  try {
    const sorted = [...dates].sort();
    const startDate = sorted[0];
    const endDate = sorted[sorted.length - 1];
    
    const data = await dataStore.fetchWeightData({ startDate, endDate });
    
    if (data && data.dailyData) {
      const weightChartData = data.dailyData.map(item => ({
        date: item.date,
        avgWeight: item.avgWeight
      }));
      if (weightChartData.length > 0) {
        const mergedData = chartData.value.map(item => {
          const weightItem = weightChartData.find(w => w.date === item.date);
          return weightItem ? { ...item, avgWeight: weightItem.avgWeight } : item;
        });
        chartData.value = mergedData;
      }
    }
  } catch (error) {
    console.error('Failed to fetch weight data for sidebar:', error);
  }
}

// Fetch weight data for the current date range
async function fetchWeightData() {
  if (dateStore.selectedDates.length === 0) return;
  
  try {
    const sorted = [...dateStore.selectedDates].sort();
    const startDate = sorted[0];
    const endDate = sorted[sorted.length - 1];
    
    loading.value = true;
    const data = await dataStore.fetchWeightData({ startDate, endDate });
    weightData.value = data;
    
    // Also update chartData with weight info for sidebar card display
    if (data && data.dailyData) {
      const weightChartData = data.dailyData.map(item => ({
        date: item.date,
        avgWeight: item.avgWeight
      }));
      // Merge weight data into chartData for sidebar display
      if (weightChartData.length > 0) {
        const mergedData = chartData.value.map(item => {
          const weightItem = weightChartData.find(w => w.date === item.date);
          return weightItem ? { ...item, avgWeight: weightItem.avgWeight } : item;
        });
        chartData.value = mergedData;
      }
    }
  } catch (error) {
    console.error('Failed to fetch weight data:', error);
    weightData.value = null;
  } finally {
    loading.value = false;
  }
}

// Get last 30 days with training data
function getLast30Days() {
  const trainingDates = dateStore.trainingDates;
  if (trainingDates.length === 0) return [];
  
  // Sort dates descending and take first 30
  const sorted = [...trainingDates].sort((a, b) => new Date(b) - new Date(a));
  return sorted.slice(0, 30);
}

// Initialize default data
async function initDefaultData() {
  loading.value = true;
  
  // Wait for date list to be loaded
  if (dateStore.dateList.length === 0) {
    await dateStore.fetchDateList();
  }
  
  // Set default to single mode for debugging
  viewMode.value = 'single';
  
  // Select the most recent date with training data
  const trainingDates = dateStore.trainingDates;
  if (trainingDates.length > 0) {
    const sorted = [...trainingDates].sort((a, b) => new Date(b) - new Date(a));
    const mostRecentDate = sorted[0];
    dateStore.selectedDate = mostRecentDate;
    await fetchSingleDayData(mostRecentDate);
    console.log('Loaded single day data for:', mostRecentDate);
  } else {
    console.warn('No training dates available');
  }
  
  loading.value = false;
}

// Watch for changes in single mode
watch(() => dateStore.selectedDate, async (newDate) => {
  if (viewMode.value === 'single') {
    // Keep current chart type when switching dates in single mode
    await fetchSingleDayData(newDate);
    
    // Re-fetch sleep timeline if currently viewing sleep chart
    if (currentChartType.value === 'sleep' && newDate) {
      sleepTimelineData.value = await dataStore.fetchSleepTimeline(newDate);
    }
  }
});

// Watch for changes in compare mode
watch(() => dateStore.selectedDates, async (newDates) => {
  if (viewMode.value === 'compare') {
    currentChartType.value = 'steps';
    weightData.value = null; // Clear weight data on mode switch
    await fetchCompareData(newDates);
  }
}, { deep: true });

// Watch for view mode changes
watch(viewMode, async (newMode) => {
  // Set default chart type based on mode
  currentChartType.value = newMode === 'single' ? 'sport' : 'steps';
  
  // Clear sleep timeline data when switching modes
  sleepTimelineData.value = null;
  weightData.value = null; // Clear weight data on mode switch
  
  if (newMode === 'single') {
    // Switch to single mode
    // If no date is selected, use the most recent date
    // Otherwise, keep the previously selected date
    if (!dateStore.selectedDate && dateStore.dateList.length > 0) {
      dateStore.selectedDate = dateStore.dateList[0];
    }
    
    if (dateStore.selectedDate) {
      await fetchSingleDayData(dateStore.selectedDate);
    }
  } else {
    // Switch to compare mode with last 30 days
    const last30Days = getLast30Days();
    dateStore.selectedDates = last30Days;
    await fetchCompareData(last30Days);
  }
});

// Initialize on mount
onMounted(() => {
  initDefaultData();
});
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.content-area {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
  background: var(--app-bg);
}

.sidebar-wrapper {
  width: 320px;
  flex-shrink: 0;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow-y: auto;
  border: 1px solid var(--card-border);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Drawer content styles */
.drawer-content {
  padding: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--card-bg);
  border-radius: 8px;
  border: 1px solid var(--card-border);
}

.setting-item:last-child {
  margin-bottom: 0;
}

.icon-emoji {
  font-size: 20px;
  line-height: 1;
}

.setting-label {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
}
</style>
