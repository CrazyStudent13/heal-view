<template>
  <DatePicker v-if="dateStore.viewMode === 'single'" />
  <DateRangePicker v-else />
</template>

<script setup>
import { useDateStore } from '../../stores/dateStore.js';
import DatePicker from './DatePicker.vue';
import DateRangePicker from './DateRangePicker.vue';

const dateStore = useDateStore();
</script>

<style scoped lang="scss">
:deep(.el-date-editor) {
  margin-left: 12px;
}

@media (max-width: 900px) {
  :deep(.dashboard-date-picker),
  :deep(.dashboard-date-range-picker) {
    width: min(360px, 100%);
  }
}

@media (max-width: 760px) {
  :deep(.el-date-editor) {
    width: 100%;
    margin-left: 0;
  }
}
</style>
