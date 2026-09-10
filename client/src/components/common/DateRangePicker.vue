<template>
  <el-date-picker
    v-model="selectedRange"
    class="dashboard-date-range-picker"
    type="daterange"
    :start-placeholder="t('nav.startDate')"
    :end-placeholder="t('nav.endDate')"
    format="YYYY-MM-DD"
    value-format="YYYY-MM-DD"
    :shortcuts="dateShortcuts"
    :aria-label="`${t('nav.startDate')} - ${t('nav.endDate')}`"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useLocaleStore } from '../../stores/localeStore.js';

const dateStore = useDateStore();
const localeStore = useLocaleStore();
const { t } = localeStore;

const selectedRange = computed({
  get: () => dateStore.selectedDateRange,
  set: value => dateStore.selectDateRange(value)
});

const dateShortcuts = computed(() => [
  {
    text: t('nav.lastWeek'),
    value: () => createRange(7)
  },
  {
    text: t('nav.lastMonth'),
    value: () => createRange(30)
  },
  {
    text: t('nav.lastThreeMonths'),
    value: () => createRange(90)
  },
  {
    text: t('nav.lastHalfYear'),
    value: () => createMonthRange(6)
  },
  {
    text: t('nav.lastYear'),
    value: () => createMonthRange(12)
  }
]);

function createRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return [formatDate(start), formatDate(end)];
}

function createMonthRange(months) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  return [formatDate(start), formatDate(end)];
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
</script>

<style scoped lang="scss">
.dashboard-date-range-picker {
  width: 360px;
}
</style>
