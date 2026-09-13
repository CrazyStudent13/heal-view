import test from 'node:test';
import assert from 'node:assert/strict';
import { useDashboardRequests } from '../../client/src/pages/dashboard/composables/useDashboardRequests.js';

function ref(value) {
  return { value };
}

function createHarness({ selectedDate = null, view = 'single', dataStore = {} } = {}) {
  const dateStore = { selectedDate, selectedDates: [] };
  const store = {
    fetchDailySummary: async () => null,
    fetchSleepTimeline: async () => null,
    fetchWeightData: async () => ({ dailyData: [] }),
    ...dataStore
  };
  const viewMode = ref(view);
  const currentChartType = ref('summary');
  const chartData = ref([]);
  const sleepTimelineData = ref(null);
  const compareSleepTimelineData = ref([]);
  const weightData = ref(null);
  const loading = ref(false);
  const requests = useDashboardRequests({
    dateStore,
    dataStore: store,
    viewMode,
    currentChartType,
    chartData,
    sleepTimelineData,
    compareSleepTimelineData,
    weightData,
    loading,
    datesKey: dates => dates.join('|')
  });
  return { ...requests, dateStore, viewMode, chartData, loading };
}

test('loads and normalizes the selected single-day summary', async () => {
  const harness = createHarness({
    selectedDate: '2026-09-08',
    dataStore: { fetchDailySummary: async () => ({ steps: '1200', calories: '456' }) }
  });

  await harness.fetchSingleDayData('2026-09-08');

  assert.equal(harness.loading.value, false);
  assert.equal(harness.chartData.value[0].date, '2026-09-08');
  assert.equal(harness.chartData.value[0].steps, 1200);
  assert.equal(harness.chartData.value[0].calories, 456);
});

test('sorts compare summaries chronologically and ignores missing dates', async () => {
  const harness = createHarness({
    view: 'compare',
    dataStore: {
      fetchDailySummary: async date => date === '2026-09-08'
        ? { steps: 8 }
        : date === '2026-09-06' ? { steps: 6 } : null
    }
  });

  await harness.fetchCompareData(['2026-09-08', '2026-09-07', '2026-09-06'], { includeWeightForSidebar: false });

  assert.deepEqual(harness.chartData.value.map(row => row.date), ['2026-09-06', '2026-09-08']);
  assert.equal(harness.loading.value, false);
});

test('does not apply stale single-day responses after a newer request', async () => {
  let resolveFirst;
  const first = new Promise(resolve => { resolveFirst = resolve; });
  const harness = createHarness({
    selectedDate: '2026-09-08',
    dataStore: { fetchDailySummary: date => date === '2026-09-08' ? first : Promise.resolve({ steps: 9 }) }
  });

  const firstRequest = harness.fetchSingleDayData('2026-09-08');
  harness.dateStore.selectedDate = '2026-09-09';
  await harness.fetchSingleDayData('2026-09-09');
  resolveFirst({ steps: 8 });
  await firstRequest;

  assert.deepEqual(harness.chartData.value.map(row => row.date), ['2026-09-09']);
});
