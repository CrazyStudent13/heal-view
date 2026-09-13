<template>
  <details v-if="rows.length" class="chart-data-summary">
    <summary>{{ t('a11y.dataSummary') }}</summary>
    <div class="chart-data-summary__scroll" tabindex="0" :aria-label="t('a11y.dataTable')">
      <table>
        <caption class="sr-only">{{ title }}</caption>
        <thead><tr><th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="row.date || index">
            <td v-for="column in columns" :key="column.key">{{ formatCell(row, column) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>

<script setup>
import { computed } from 'vue';
import { formatDate, formatNumber } from '@/i18n/index.js';
import { useLocaleStore } from '@/stores/localeStore.js';

const props = defineProps({
  data: { type: Array, default: () => [] },
  chartType: { type: String, default: '' },
  title: { type: String, default: '' }
});
const { t } = useLocaleStore();

const definitions = computed(() => ({
  steps: [
    { key: 'date', label: t('a11y.date') },
    { key: 'steps', label: t('data.steps'), unit: 'settings.units.steps' },
    { key: 'distance', label: t('chart.distance'), unit: 'settings.units.km', transform: value => Number(value) / 1000 },
    { key: 'totalDurationMinutes', label: t('chart.avgExerciseDuration'), unit: 'settings.units.minutes' }
  ],
  calories: [
    { key: 'date', label: t('a11y.date') },
    { key: 'calories', label: t('data.calories'), unit: 'settings.units.kcal' }
  ],
  heartrate: [
    { key: 'date', label: t('a11y.date') },
    { key: 'avgHeartRate', label: t('chart.avgHeartRate'), unit: 'settings.units.bpm' },
    { key: 'maxHeartRate', label: t('chart.maxHeartRate'), unit: 'settings.units.bpm' }
  ],
  sleep: [
    { key: 'date', label: t('a11y.date') },
    { key: 'sleepHours', label: t('data.sleep'), unit: 'settings.units.hours' },
    { key: 'deepSleepHours', label: t('chart.deepSleep'), unit: 'settings.units.hours' },
    { key: 'lightSleepHours', label: t('chart.lightSleep'), unit: 'settings.units.hours' }
  ],
  weight: [
    { key: 'date', label: t('a11y.date') },
    { key: 'avgWeight', label: t('data.weight'), unit: 'settings.units.kg' }
  ]
}));
const columns = computed(() => definitions.value[props.chartType] || []);
const rows = computed(() => columns.value.length ? props.data.filter(Boolean) : []);

function formatCell(row, column) {
  const rawValue = row?.[column.key];
  if (column.key === 'date') return rawValue ? formatDate(rawValue) : '--';
  if (rawValue === null || rawValue === undefined || rawValue === '') return '--';
  const value = column.transform ? column.transform(rawValue) : rawValue;
  const formatted = typeof value === 'number' ? formatNumber(value, { maximumFractionDigits: 2 }) : value;
  return column.unit ? `${formatted} ${t(column.unit)}` : formatted;
}
</script>

<style scoped lang="scss">
.chart-data-summary { flex-shrink: 0; margin-top: 12px; border-top: 1px solid var(--card-border); color: var(--text-primary); }
.chart-data-summary summary { width: fit-content; padding: 12px 2px; color: var(--primary-color); cursor: pointer; font-weight: 600; }
.chart-data-summary summary:focus-visible,
.chart-data-summary__scroll:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
.chart-data-summary__scroll { max-height: 280px; overflow: auto; }
table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 14px; }
th, td { padding: 9px 12px; border-bottom: 1px solid var(--card-border); text-align: left; white-space: nowrap; }
th { position: sticky; top: 0; background: var(--card-bg); color: var(--text-secondary); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
</style>
