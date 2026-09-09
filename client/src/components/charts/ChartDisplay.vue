<template>
  <div class="chart-display">
    <el-alert
      v-if="errorMessage"
      class="chart-error"
      type="warning"
      :title="errorMessage"
      show-icon
      :closable="false"
    />

    <div v-if="refreshing" class="refresh-indicator">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>

    <!-- Single day mode: show different content based on chart type -->
    <template v-if="viewMode === 'single'">
      <!-- Default to sport records when no specific chart selected -->
      <DailySportChart
        v-if="chartType === 'sport' || chartType === 'steps'"
      />
      
      <!-- Show time series heart rate chart for single day mode -->
      <SingleDayHeartRateChart
        v-if="chartType === 'heartrate'"
      />
      
      <!-- Show personal data view -->
      <PersonalDataView
        v-if="chartType === 'personal'"
        :profile-data="userProfile"
        :chart-data="chartData"
        :loading="loading"
      />
      
      <!-- Show other charts when explicitly selected (no calories in single mode) -->
      <SleepTimelineChart
        v-if="chartType === 'sleep' && hasDetailedSleepData"
        :data="sleepTimelineData"
        :avg-heart-rate="singleAvgHeartRate"
      />
      <SleepChart
        v-if="chartType === 'sleep' && !hasDetailedSleepData && hasSleepSummaryData"
        :data="chartData"
      />
      <ChartPanel
        v-if="chartType === 'sleep' && !hasDetailedSleepData && !hasSleepSummaryData"
        :empty="!loading"
        :loading="loading"
        :empty-description="t('chart.noSleepData')"
      />
    </template>

    <!-- Multi-day comparison mode: show traditional charts -->
    <template v-else-if="viewMode === 'compare'">
      <StepsChart v-if="chartType === 'steps'" :data="chartData" :loading="loading" />
      <CaloriesChart v-if="chartType === 'calories' && hasData" :data="chartData" />
      <HeartRateChart v-if="chartType === 'heartrate' && hasData" :data="chartData" />
      <SleepChart v-if="chartType === 'sleep' && hasData" :data="chartData" :timeline-list="compareSleepTimelineData" />
      <WeightChart v-if="chartType === 'weight'" :weight-data="weightData" :loading="loading" />
    </template>

    <!-- Empty state for compare mode -->
    <div v-if="!hasData && !loading && viewMode === 'compare'" class="empty-state">
      <p>{{ t('chart.selectDate') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { useLocaleStore } from '../../stores/localeStore';
import { normalizeErrorText } from '../../utils/requestState.js';
import ChartPanel from '../common/ChartPanel.vue';

function createLazyChart(loader) {
  return defineAsyncComponent({
    loader,
    delay: 0,
    timeout: 30000,
    suspensible: false
  });
}

const StepsChart = createLazyChart(() => import('./StepsChart.vue'));
const CaloriesChart = createLazyChart(() => import('./CaloriesChart.vue'));
const HeartRateChart = createLazyChart(() => import('./HeartRateChart.vue'));
const SleepChart = createLazyChart(() => import('./SleepChart.vue'));
const SleepTimelineChart = createLazyChart(() => import('./SleepTimelineChart.vue'));
const DailySportChart = createLazyChart(() => import('./DailySportChart.vue'));
const SingleDayHeartRateChart = createLazyChart(() => import('./SingleDayHeartRateChart.vue'));
const WeightChart = createLazyChart(() => import('./WeightChart.vue'));
const PersonalDataView = createLazyChart(() => import('./PersonalDataView.vue'));

const localeStore = useLocaleStore();
const { t } = localeStore;

const props = defineProps({
  chartData: {
    type: Array,
    default: () => []
  },
  chartType: {
    type: String,
    default: 'steps'
  },
  viewMode: {
    type: String,
    default: 'single'
  },
  loading: {
    type: Boolean,
    default: false
  },
  refreshing: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  sleepTimelineData: {
    type: Object,
    default: null
  },
  compareSleepTimelineData: {
    type: Array,
    default: () => []
  },
  weightData: {
    type: Object,
    default: null
  },
  userProfile: {
    type: Object,
    default: null
  }
});

const hasData = computed(() => props.chartData.length > 0);

const errorMessage = computed(() => {
  return normalizeErrorText(props.error);
});

const hasDetailedSleepData = computed(() => {
  return Boolean(props.sleepTimelineData?.segments?.length);
});

const hasSleepSummaryData = computed(() => {
  if (!hasData.value) return false;
  return props.chartData.some((item) => {
    return ['sleepHours', 'deepSleepHours', 'lightSleepHours', 'remSleepHours', 'awakeSleepHours']
      .some((key) => Number(item?.[key]) > 0);
  });
});

// 单日模式下的平均心率（用于睡眠卡片）
const singleAvgHeartRate = computed(() => {
  if (props.chartData.length > 0 && props.chartData[0].avgHeartRate) {
    return props.chartData[0].avgHeartRate;
  }
  return null;
});
</script>

<style scoped lang="scss">
.chart-display {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  position: relative;
}

.chart-error {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.chart-display :deep(.personal-data-view) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.chart-display :deep(.personal-data-view > .content-wrapper) {
  flex: 1;
  min-height: 0;
}

.refresh-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.empty-state, .loading-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
  background: var(--card-bg);
  border-radius: 8px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

