<template>
  <div class="chart-display">
    <!-- Single day mode: show different content based on chart type -->
    <template v-if="viewMode === 'single'">
      <!-- Default to sport records when no specific chart selected -->
      <DailySportChart v-if="chartType === 'sport' || chartType === 'steps'" />
      
      <!-- Show time series heart rate chart for single day mode -->
      <SingleDayHeartRateChart v-if="chartType === 'heartrate'" />
      
      <!-- Show personal data view -->
      <PersonalDataView v-if="chartType === 'personal'" :profile-data="userProfile" :chart-data="chartData" :loading="loading" />
      
      <!-- Show other charts when explicitly selected (no calories in single mode) -->
      <SleepTimelineChart v-if="chartType === 'sleep' && hasDetailedSleepData" :data="sleepTimelineData" :avg-heart-rate="singleAvgHeartRate" />
      <SleepChart v-if="chartType === 'sleep' && !hasDetailedSleepData && hasSleepSummaryData" :data="chartData" />
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
import { computed } from 'vue';
import StepsChart from './StepsChart.vue';
import CaloriesChart from './CaloriesChart.vue';
import HeartRateChart from './HeartRateChart.vue';
import SleepChart from './SleepChart.vue';
import SleepTimelineChart from './SleepTimelineChart.vue';
import DailySportChart from './DailySportChart.vue';
import SingleDayHeartRateChart from './SingleDayHeartRateChart.vue';
import WeightChart from './WeightChart.vue';
import PersonalDataView from './PersonalDataView.vue';
import { useLocaleStore } from '../../stores/localeStore';

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

<style scoped>
.chart-display {
  height: 100%;
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
