<template>
  <ChartDisplay
    :chart-data="chartData"
    :chart-type="chartType"
    :view-mode="viewMode"
    :loading="loading"
    :refreshing="refreshing"
    :error="error"
    :sleep-timeline-data="sleepTimelineData"
    :compare-sleep-timeline-data="compareSleepTimelineData"
    :weight-data="weightData"
    :user-profile="userProfile"
  />
</template>

<script setup>
import ChartDisplay from '@/components/charts/ChartDisplay.vue';

defineProps({
  chartData: { type: Array, default: () => [] },
  chartType: { type: String, default: 'personal' },
  viewMode: { type: String, default: 'single' },
  loading: Boolean,
  refreshing: Boolean,
  error: { type: String, default: '' },
  sleepTimelineData: { type: Object, default: null },
  compareSleepTimelineData: { type: Array, default: () => [] },
  weightData: { type: Object, default: null },
  userProfile: { type: Object, default: null }
});
</script>
