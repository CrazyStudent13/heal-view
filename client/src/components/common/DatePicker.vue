<template>
  <el-date-picker
    v-model="selectedDate"
    class="dashboard-date-picker"
    type="date"
    :placeholder="t('nav.selectDate')"
    format="YYYY-MM-DD (dddd)"
    value-format="YYYY-MM-DD"
    :disabled-date="disabledDate"
    :aria-label="t('nav.selectDate')"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useDateStore } from '../../stores/dateStore.js';
import { useLocaleStore } from '../../stores/localeStore.js';

const dateStore = useDateStore();
const localeStore = useLocaleStore();

const selectedDate = computed({
  get: () => dateStore.selectedDate || '',
  set: value => dateStore.selectDate(value)
});

const { t } = localeStore;

function disabledDate(time) {
  return time.getTime() > Date.now();
}
</script>

<style scoped lang="scss">
.dashboard-date-picker {
  width: 220px;
}
</style>
