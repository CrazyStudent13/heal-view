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
      size="320px"
    >
      <div class="drawer-content">
        <!-- Language setting -->
        <div class="setting-item">
          <div class="setting-label">
            <span class="icon-emoji">🌐</span>
            <span>{{ t('settings.language') }}</span>
          </div>
          <el-select v-model="currentLanguage" size="default" style="width: 140px">
            <el-option label="中文" value="zh-CN" />
            <el-option label="English" value="en" />
          </el-select>
        </div>

        <!-- Theme setting -->
        <div class="setting-item">
          <div class="setting-label">
            <span class="icon-emoji">{{ isDarkMode ? '' : '☀️' }}</span>
            <span>{{ t('settings.theme') }}</span>
          </div>
          <el-switch
            v-model="isDarkMode"
            inline-prompt
            active-text="暗"
            inactive-text="亮"
            size="default"
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
          @chart-change="handleChartChange"
        />
      </div>
      
      <!-- Right area: Chart display -->
      <div class="chart-area">
        <!-- Settings panel -->
        <SettingsPanel 
          @language-change="handleLanguageChange"
          @theme-change="handleThemeChange"
        />
        
        <ChartDisplay 
          :chart-data="chartData"
          :chart-type="currentChartType"
          :view-mode="viewMode"
          :loading="loading"
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

const viewMode = ref('compare'); // Default to compare mode
const currentChartType = ref('steps');
const chartData = ref([]);
const loading = ref(false);

const dateStore = useDateStore();
const dataStore = useDataStore();

// Handle chart type change
function handleChartChange(type) {
  currentChartType.value = type;
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
      calories: summary.calories,
      avgHeartRate: summary.avgHeartRate,
      maxHeartRate: summary.maxHeartRate,
      avgStress: summary.avgStress,
      sleepHours: summary.sleepHours || 0,
      deepSleepHours: summary.deepSleepHours || 0,
      lightSleepHours: summary.lightSleepHours || 0,
      remSleepHours: summary.remSleepHours || 0
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
  
  // Set default to compare mode with last 30 days
  viewMode.value = 'compare';
  const last30Days = getLast30Days();
  
  console.log('Last 30 days:', last30Days);
  console.log('Training dates:', dateStore.trainingDates);
  
  if (last30Days.length > 0) {
    dateStore.selectedDates = last30Days;
    await fetchCompareData(last30Days);
    console.log('Chart data loaded:', chartData.value.length, 'items');
  } else {
    console.warn('No training dates available');
  }
  
  loading.value = false;
}

// Watch for changes in single mode
watch(() => dateStore.selectedDate, async (newDate) => {
  if (viewMode.value === 'single') {
    currentChartType.value = 'steps';
    await fetchSingleDayData(newDate);
  }
});

// Watch for changes in compare mode
watch(() => dateStore.selectedDates, async (newDates) => {
  if (viewMode.value === 'compare') {
    currentChartType.value = 'steps';
    await fetchCompareData(newDates);
  }
}, { deep: true });

// Watch for view mode changes
watch(viewMode, async (newMode) => {
  currentChartType.value = 'steps';
  
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
  overflow: hidden;
  border: 1px solid var(--card-border);
}

.chart-area {
  flex: 1;
  overflow-y: auto;
}
</style>
