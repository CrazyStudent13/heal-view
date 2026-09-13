<!-- 模块：图表展示容器，根据当前图表类型和视图模式切换具体图表。 -->
<template>
  <div
    class="chart-display"
    role="region"
    :aria-label="chartAriaLabel"
    :aria-busy="loading"
  >
    <AsyncState
      v-if="errorMessage"
      class="chart-error"
      :error="errorMessage"
    />

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
    <AsyncState
      v-if="!hasData && !loading && viewMode === 'compare'"
      class="chart-empty"
      empty
      :empty-description="t('chart.selectDate')"
    />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue';
import { useLocaleStore } from '@/stores/localeStore';
import { normalizeErrorText } from '@/utils/requestState.js';
import AsyncState from '@/components/ui/AsyncState.vue';
import ChartPanel from '@/components/ui/ChartPanel.vue';

function createLazyChart(loader) {
  return defineAsyncComponent({
    loader,
    delay: 0,
    timeout: 30000,
    suspensible: false
  });
}

const StepsChart = createLazyChart(() => import('@/components/charts/StepsChart.vue'));
const CaloriesChart = createLazyChart(() => import('@/components/charts/CaloriesChart.vue'));
const HeartRateChart = createLazyChart(() => import('@/components/charts/HeartRateChart.vue'));
const SleepChart = createLazyChart(() => import('@/components/charts/SleepChart.vue'));
const SleepTimelineChart = createLazyChart(() => import('@/components/charts/SleepTimelineChart.vue'));
const DailySportChart = createLazyChart(() => import('@/components/charts/DailySportChart.vue'));
const SingleDayHeartRateChart = createLazyChart(() => import('@/components/charts/SingleDayHeartRateChart.vue'));
const WeightChart = createLazyChart(() => import('@/components/charts/WeightChart.vue'));
const PersonalDataView = createLazyChart(() => import('@/components/charts/PersonalDataView.vue'));

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

const chartAriaLabel = computed(() => {
  const labels = {
    personal: 'personal.title',
    sport: 'chart.dailySportActivities',
    steps: 'chart.stepsDistanceTrend',
    calories: 'data.calories',
    heartrate: 'chart.heartRateTrend',
    sleep: 'chart.sleepOverview',
    weight: 'weight.title'
  };
  return t(labels[props.chartType] || 'chart.noData');
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

.chart-empty {
  min-height: 240px;
}
</style>

