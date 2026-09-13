<template>
  <section class="dashboard-page">
    <div class="dashboard-grid">
      <DashboardSidebar
        :chart-data="chartData"
        :current-chart-type="currentChartType"
        :view-mode="viewMode"
        :loading="initialLoading"
        :user-profile="userProfile"
        @chart-change="dashboard.handleChartChange"
        @update:view-mode="setViewMode"
      />

      <main class="chart-area">
        <DashboardChartArea
          :chart-data="chartData"
          :chart-type="currentChartType"
          :view-mode="viewMode"
          :loading="loading"
          :refreshing="refreshing"
          :error="dashboardError"
          :sleep-timeline-data="sleepTimelineData"
          :compare-sleep-timeline-data="compareSleepTimelineData"
          :weight-data="weightData"
          :user-profile="userProfile"
        />
      </main>
    </div>
  </section>
</template>

<script setup>
import DashboardSidebar from '@/pages/dashboard/components/DashboardSidebar.vue';
import DashboardChartArea from '@/pages/dashboard/components/DashboardChartArea.vue';
import { dashboardContextKey } from '@/composables/dashboardContext.js';
import { normalizeErrorText } from '@/utils/requestState.js';

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
const userProfile = computed(() => unref(dashboard.userProfile));
const dashboardError = computed(() => {
  return normalizeErrorText(dashboard.error?.value ?? dashboard.error);
});

function setViewMode(value) {
  viewMode.value = value;
}
</script>

<style scoped lang="scss">
.dashboard-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--app-bg);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  gap: 8px;
  padding: 8px;
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

.chart-area {
  flex: 1;
  height: 100%;
  overflow: hidden;
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
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
}

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 8px;
    height: auto;
  }

  .chart-area {
    height: auto;
    overflow: visible;
  }
}
</style>
