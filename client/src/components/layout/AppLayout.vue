<template>
  <div class="app-layout">
    <!-- Top navigation bar -->
    <TopNavbar
      v-if="route.name !== 'login'"
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
    
    <main class="layout-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed, provide, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterView, useRoute } from 'vue-router';
import { useDateStore } from '../../stores/dateStore.js';
import { useLocaleStore } from '../../stores/localeStore';
import { useThemeStore } from '../../stores/themeStore';
import { useDataStore } from '../../stores/dataStore.js';
import { useDashboardData } from '../../composables/useDashboardData.js';
import { dashboardContextKey } from '../../composables/dashboardContext.js';
import TopNavbar from '../navigation/TopNavbar.vue';

const localeStore = useLocaleStore();
const themeStore = useThemeStore();

// Translation function
function t(key) {
  return localeStore.t(key);
}

const settingsDrawerVisible = ref(false);
const route = useRoute();

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
const { userProfile, error: dataError } = storeToRefs(dataStore);
const { error: dateError } = storeToRefs(dateStore);
const dashboardError = computed(() => dataError.value || dateError.value);
const dashboard = useDashboardData(dateStore, dataStore);
const {
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
} = dashboard;

provide(dashboardContextKey, {
  ...dashboard,
  userProfile,
  error: dashboardError
});
</script>

<style scoped lang="scss">
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

.layout-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--app-bg);
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

  .layout-main {
    overflow: visible;
  }
}
</style>

