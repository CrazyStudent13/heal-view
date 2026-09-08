<template>
  <div class="content-area">
    <div class="sidebar-wrapper">
      <DataCardsSidebar
        :chart-data="chartData"
        :current-chart-type="currentChartType"
        :view-mode="viewMode"
        :loading="initialLoading"
        :user-profile="dashboard.userProfile"
        @chart-change="dashboard.handleChartChange"
        @update:view-mode="setViewMode"
      />
    </div>

    <div class="chart-area">
      <ChartDisplay
        :chart-data="chartData"
        :chart-type="currentChartType"
        :view-mode="viewMode"
        :loading="loading"
        :refreshing="refreshing"
        :error="dashboard.error || ''"
        :sleep-timeline-data="sleepTimelineData"
        :compare-sleep-timeline-data="compareSleepTimelineData"
        :weight-data="weightData"
        :user-profile="dashboard.userProfile"
      />
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue';
import DataCardsSidebar from '../components/charts/DataCardsSidebar.vue';
import ChartDisplay from '../components/charts/ChartDisplay.vue';
import { dashboardContextKey } from '../composables/dashboardContext.js';

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

function setViewMode(value) {
  viewMode.value = value;
}
</script>

<style scoped lang="scss">
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

@media (max-width: 900px) {
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
