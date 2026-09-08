<template>
  <section class="dashboard-page">
    <div class="dashboard-grid">
      <aside class="sidebar-wrapper">
        <DataCardsSidebar
          :chart-data="chartData"
          :current-chart-type="currentChartType"
          :view-mode="viewMode"
          :loading="initialLoading"
          :user-profile="dashboard.userProfile"
          @chart-change="dashboard.handleChartChange"
          @update:view-mode="setViewMode"
        />
      </aside>

      <main class="chart-area">
        <ChartDisplay
          :chart-data="chartData"
          :chart-type="currentChartType"
          :view-mode="viewMode"
          :loading="loading"
          :refreshing="refreshing"
          :error="dashboardError"
          :sleep-timeline-data="sleepTimelineData"
          :compare-sleep-timeline-data="compareSleepTimelineData"
          :weight-data="weightData"
          :user-profile="dashboard.userProfile"
        />
      </main>
    </div>
  </section>
</template>

<script setup>
import { computed, inject } from 'vue';
import DataCardsSidebar from '../components/charts/DataCardsSidebar.vue';
import ChartDisplay from '../components/charts/ChartDisplay.vue';
import { dashboardContextKey } from '../composables/dashboardContext.js';
import { normalizeErrorText } from '../utils/requestState.js';

const dashboard = inject(dashboardContextKey);

if (!dashboard) {
  throw new Error('Dashboard context is missing');
}

const viewMode = dashboard.viewMode;
const currentChartType = dashboard.currentChartType;
const chartData = dashboard.chartData;
const sleepTimelineData = dashboard.sleepTimelineData;
const compareSleepTimelineData = dashboard.compareSleepTimelineData;
const weightData = dashboard.weightData;
const loading = dashboard.loading;
const initialLoading = dashboard.initialLoading;
const refreshing = dashboard.refreshing;
const dashboardError = computed(() => {
  return normalizeErrorText(dashboard.error?.value ?? dashboard.error);
});

function setViewMode(value) {
  viewMode.value = value;
}
</script>

<style scoped lang="scss">
.dashboard-page {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--app-bg);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  gap: 8px;
  padding: 8px;
  height: 100%;
  min-height: 0;
  align-items: stretch;
}

.sidebar-wrapper {
  width: 320px;
  flex-shrink: 0;
  min-height: 0;
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow-y: auto;
  border: 1px solid var(--card-border);
  display: flex;
  flex-direction: column;
}

.chart-area {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chart-area :deep(.chart-display) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.chart-area :deep(.chart-wrapper),
.chart-area :deep(.chart-panel) {
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

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 8px;
    height: auto;
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
