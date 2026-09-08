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
          :loading="initialLoading"
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
          :refreshing="refreshing"
          :error="dataStore.error || ''"
          :sleep-timeline-data="sleepTimelineData"
          :compare-sleep-timeline-data="compareSleepTimelineData"
          :weight-data="weightData"
          :user-profile="dataStore.userProfile"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineAsyncComponent, ref, computed } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useLocaleStore } from '../../stores/localeStore';
import { useThemeStore } from '../../stores/themeStore';
import { useDataStore } from '../../stores/dataStore.js';
import { useDashboardData } from '../../composables/useDashboardData.js';
import TopNavbar from '../navigation/TopNavbar.vue';
import DataCardsSidebar from '../charts/DataCardsSidebar.vue';
import ChartDisplay from '../charts/ChartDisplay.vue';

const DataImportPage = defineAsyncComponent(() => import('../import/DataImportPage.vue'));

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

const dateStore = useDateStore();
const dataStore = useDataStore();
const {
  viewMode,
  currentChartType,
  chartData,
  sleepTimelineData,
  compareSleepTimelineData,
  weightData,
  loading,
  initialLoading,
  refreshing,
  handleChartChange,
  handleImportCompleted
} = useDashboardData(dateStore, dataStore);
</script>

<style scoped lang="scss">
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
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.chart-area :deep(.sleep-timeline-view),
.chart-area :deep(.chart-container),
.chart-area :deep(.analysis-card) {
  width: 100%;
}

.chart-area :deep(.chart-container) {
  margin-bottom: 0;
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

