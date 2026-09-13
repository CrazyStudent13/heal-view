<template>
  <aside class="sidebar-wrapper page-surface-card">
    <DataCardsSidebar
      :chart-data="chartData"
      :current-chart-type="currentChartType"
      :view-mode="viewMode"
      :loading="loading"
      :user-profile="userProfile"
      @chart-change="$emit('chart-change', $event)"
      @update:view-mode="$emit('update:view-mode', $event)"
    />
  </aside>
</template>

<script setup>
import DataCardsSidebar from '@/components/charts/DataCardsSidebar.vue';

defineProps({
  chartData: { type: Array, default: () => [] },
  currentChartType: { type: String, default: 'personal' },
  viewMode: { type: String, default: 'single' },
  loading: Boolean,
  userProfile: { type: Object, default: null }
});
defineEmits(['chart-change', 'update:view-mode']);
</script>

<style scoped lang="scss">
.sidebar-wrapper {
  width: 320px;
  flex-shrink: 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

@media (max-width: 900px) {
  .sidebar-wrapper {
    width: 100%;
    height: auto;
    overflow: visible;
  }
}
</style>
