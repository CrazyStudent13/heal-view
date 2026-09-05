<template>
  <div class="app-layout">
    <!-- Top navigation bar -->
    <TopNavbar 
      v-model:viewMode="viewMode" 
      :current-page="currentPage"
      :show-date-controls="currentPage === 'dashboard'"
      @page-change="currentPage = $event"
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
            <el-option
              v-for="locale in localeStore.availableLocales"
              :key="locale.code"
              :label="locale.label"
              :value="locale.code"
            />
          </el-select>
        </div>

        <!-- Theme setting -->
        <div class="setting-item">
          <span class="icon-emoji">{{ isDarkMode ? '' : '☀️' }}</span>
          <span class="setting-label">{{ t('settings.theme') }}</span>
          <el-switch
            v-model="isDarkMode"
            inline-prompt
            :active-text="t('settings.dark')"
            :inactive-text="t('settings.light')"
            size="default"
            style="margin-left: auto;"
          />
        </div>
      </div>
    </el-drawer>
    
    <!-- Main content area -->
    <DataImportPage
      v-if="currentPage === 'import'"
      @imported="handleImportCompleted"
      @view-dashboard="currentPage = 'dashboard'"
    />

    <div v-else class="content-area">
      <!-- Left sidebar: Data cards -->
      <div class="sidebar-wrapper">
        <DataCardsSidebar 
          :chart-data="chartData"
          :current-chart-type="currentChartType"
          :view-mode="viewMode"
          :loading="loading"
          :user-profile="dataStore.userProfile"
          @chart-change="handleChartChange"
          @update:view-mode="viewMode = $event"
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
          :user-profile="dataStore.userProfile"
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
import DataImportPage from '../import/DataImportPage.vue';

const localeStore = useLocaleStore();
const themeStore = useThemeStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

// Settings drawer visibility
const settingsDrawerVisible = ref(false);
const currentPage = ref('dashboard');

// Language - use store value
const currentLanguage = computed({
  get: () => localeStore.currentLocale,
  set: (val) => localeStore.setLocale(val)
});

// Theme - use store value
const isDarkMode = computed({
  get: () => themeStore.isDarkMode,
  set: (val) => themeStore.setTheme(val)
});

const viewMode = ref('single'); // Default to single day mode for debugging
const currentChartType = ref('personal'); // Default to personal/basic info in single mode
const chartData = ref([]);
const sleepTimelineData = ref(null);
const weightData = ref(null);
const loading = ref(false);
const initializing = ref(false);
let singleFetchSeq = 0;
let compareFetchSeq = 0;
let sleepFetchSeq = 0;
let weightFetchSeq = 0;
let weightSidebarFetchSeq = 0;

const dateStore = useDateStore();
const dataStore = useDataStore();

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultSingleDate() {
  if (dateStore.selectedDate) return dateStore.selectedDate;
  if (dateStore.dateList.length === 0) return null;

  const today = formatLocalDate(new Date());
  return dateStore.dateList.includes(today) ? today : dateStore.dateList[0];
}

function isCompareChartType(type) {
  return ['weight', 'steps', 'heartrate', 'sleep', 'calories'].includes(type);
}

function datesKey(dates) {
  return [...dates].sort().join('|');
}

async function fetchSleepTimelineForDate(date) {
  const requestId = ++sleepFetchSeq;
  if (!date) {
    sleepTimelineData.value = null;
    return;
  }

  sleepTimelineData.value = null;
  const timeline = await dataStore.fetchSleepTimeline(date);
  if (requestId === sleepFetchSeq && dateStore.selectedDate === date && currentChartType.value === 'sleep') {
    sleepTimelineData.value = timeline;
  }
}

// Handle chart type change
async function handleChartChange(type) {
  // Handle personal data chart type - fetch user profile first
  if (type === 'personal') {
    if (!dataStore.userProfile) {
      loading.value = true;
      await dataStore.fetchUserProfile();
      loading.value = false;
    }
  }

  currentChartType.value = type;
  
  // Fetch sleep timeline when switching to sleep chart in single mode
  if (type === 'sleep' && viewMode.value === 'single' && dateStore.selectedDate) {
    await fetchSleepTimelineForDate(dateStore.selectedDate);
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
  const requestId = ++singleFetchSeq;

  if (!date) {
    chartData.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  const summary = await dataStore.fetchDailySummary(date);
  if (requestId !== singleFetchSeq || viewMode.value !== 'single' || dateStore.selectedDate !== date) {
    return;
  }

  if (summary) {
    chartData.value = [{
      date: summary.date,
      steps: summary.steps,
      distance: summary.distance,
      calories: summary.calories,
      avgHeartRate: summary.avgHeartRate,
      minHeartRate: summary.minHeartRate,
      maxHeartRate: summary.maxHeartRate,
      avgStress: summary.avgStress,
      bloodPressureCount: summary.bloodPressureCount || 0,
      avgSystolic: summary.avgSystolic || 0,
      avgDiastolic: summary.avgDiastolic || 0,
      latestBloodPressure: summary.latestBloodPressure || null,
      bloodPressureRecords: summary.bloodPressureRecords || [],
      sleepHours: summary.sleepHours || 0,
      deepSleepHours: summary.deepSleepHours || 0,
      lightSleepHours: summary.lightSleepHours || 0,
      remSleepHours: summary.remSleepHours || 0,
      awakeSleepHours: summary.awakeSleepHours || 0,
      totalDurationMinutes: summary.totalDurationMinutes || 0,
      sportCalories: summary.sportCalories || 0
    }];
  } else {
    chartData.value = [];
  }

  if (requestId === singleFetchSeq) {
    loading.value = false;
  }
}

// Fetch data for compare mode
async function fetchCompareData(dates, options = {}) {
  const { includeWeightForSidebar = true } = options;
  const requestId = ++compareFetchSeq;

  if (dates.length === 0) {
    chartData.value = [];
    loading.value = false;
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
  if (requestId !== compareFetchSeq || viewMode.value !== 'compare') {
    return;
  }

  chartData.value = data.sort((a, b) => new Date(a.date) - new Date(b.date));
  loading.value = false;
  
  // Async fetch weight data for sidebar card display (don't block loading)
  if (includeWeightForSidebar) {
    fetchWeightDataForSidebar(dates);
  }
}

// Fetch weight data only for sidebar display (no loading state change)
async function fetchWeightDataForSidebar(dates) {
  const requestId = ++weightSidebarFetchSeq;
  if (dates.length === 0) return;
  const requestedKey = datesKey(dates);
  
  try {
    const sorted = [...dates].sort();
    const startDate = sorted[0];
    const endDate = sorted[sorted.length - 1];
    
    const data = await dataStore.fetchWeightData({ startDate, endDate });
    if (
      requestId !== weightSidebarFetchSeq ||
      viewMode.value !== 'compare' ||
      requestedKey !== datesKey(dateStore.selectedDates)
    ) {
      return;
    }
    
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
async function fetchWeightData(dates = dateStore.selectedDates) {
  const requestId = ++weightFetchSeq;
  weightSidebarFetchSeq++;
  if (dates.length === 0) {
    weightData.value = null;
    loading.value = false;
    return;
  }
  
  try {
    const sorted = [...dates].sort();
    const startDate = sorted[0];
    const endDate = sorted[sorted.length - 1];
    
    loading.value = true;
    const data = await dataStore.fetchWeightData({ startDate, endDate });
    if (requestId !== weightFetchSeq || viewMode.value !== 'compare') {
      return;
    }

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
    if (requestId === weightFetchSeq) {
      weightData.value = null;
    }
  } finally {
    if (requestId === weightFetchSeq) {
      loading.value = false;
    }
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
  initializing.value = true;
  loading.value = true;

  try {
    // Wait for date list to be loaded
    if (dateStore.dateList.length === 0) {
      await dateStore.fetchDateList();
    }
    
    // Set default to single mode for debugging
    viewMode.value = 'single';
    
    // Keep the date picker and loaded data on the same default date.
    const defaultDate = getDefaultSingleDate();
    if (defaultDate) {
      dateStore.selectDate(defaultDate);
      await fetchSingleDayData(defaultDate);
      await dataStore.fetchUserProfile();
      console.log('Loaded single day data for:', defaultDate);
    } else {
      console.warn('No dates available');
    }
  } finally {
    loading.value = false;
    initializing.value = false;
  }
}

async function handleImportCompleted() {
  dataStore.clearCache();
  dateStore.clearCache();
  await initDefaultData();
}

// Watch for changes in single mode
watch(() => dateStore.selectedDate, async (newDate) => {
  if (initializing.value) return;

  if (viewMode.value === 'single') {
    // Keep current chart type when switching dates in single mode
    await fetchSingleDayData(newDate);
    
    // Re-fetch sleep timeline if currently viewing sleep chart
    if (currentChartType.value === 'sleep' && newDate) {
      await fetchSleepTimelineForDate(newDate);
    }
  }
});

// Watch for changes in compare mode
watch(() => dateStore.selectedDates, async (newDates) => {
  if (initializing.value) return;

  if (viewMode.value === 'compare') {
    if (!isCompareChartType(currentChartType.value)) {
      currentChartType.value = 'weight';
    }

    if (currentChartType.value === 'weight') {
      await fetchCompareData(newDates, { includeWeightForSidebar: false });
      await fetchWeightData(newDates);
    } else {
      await fetchCompareData(newDates);
    }
  }
}, { deep: true });

// Watch for view mode changes
watch(viewMode, async (newMode) => {
  // Set default chart type based on mode
  currentChartType.value = newMode === 'single' ? 'personal' : 'weight';
  
  // Clear sleep timeline data when switching modes
  sleepTimelineData.value = null;
  weightData.value = null; // Clear weight data on mode switch
  
  if (newMode === 'single') {
    // Switch to single mode
    // If no date is selected, use the most recent date
    // Otherwise, keep the previously selected date
    if (!dateStore.selectedDate) {
      const defaultDate = getDefaultSingleDate();
      if (defaultDate) {
        dateStore.selectDate(defaultDate);
      }
    }
    
    if (dateStore.selectedDate) {
      await fetchSingleDayData(dateStore.selectedDate);
    }
  } else {
    // Switch to compare mode with last 30 days
    const last30Days = getLast30Days();
    dateStore.selectedDates = last30Days;
    await fetchCompareData(last30Days);
    await fetchWeightData();
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
  height: 100dvh;
  overflow: hidden;
}

.content-area {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  min-height: 0;
  align-items: stretch;
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
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chart-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.chart-area :deep(.chart-display) {
  flex: 1;
  min-height: 0;
}

.chart-area :deep(.sleep-timeline-view),
.chart-area :deep(.chart-container),
.chart-area :deep(.analysis-card) {
  width: 100%;
}

.chart-area :deep(.sleep-timeline-view) {
  min-height: 0;
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

@media (max-width: 900px) {
  .app-layout {
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }

  .content-area {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    overflow: visible;
  }

  .sidebar-wrapper {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .chart-area {
    height: auto;
    overflow: visible;
  }
}
</style>
