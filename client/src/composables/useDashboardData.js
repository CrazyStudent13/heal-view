import { ref, computed, watch, onMounted } from 'vue';
import { normalizeDailySummary, normalizeSleepTimeline, normalizeWeightData } from '../domain/healthDataFallbacks.js';
import { createLatestRequest } from '../utils/requestState.js';

export function useDashboardData(dateStore, dataStore) {
  const viewMode = computed({
    get: () => dateStore.viewMode,
    set: value => dateStore.setViewMode(value)
  });
  const currentChartType = ref('personal');
  const chartData = ref([]);
  const sleepTimelineData = ref(null);
  const compareSleepTimelineData = ref([]);
  const weightData = ref(null);
  const loading = ref(false);
  const initializing = ref(false);

  const singleRequest = createLatestRequest();
  const compareRequest = createLatestRequest();
  const sleepRequest = createLatestRequest();
  const compareSleepRequest = createLatestRequest();
  const weightRequest = createLatestRequest();
  const weightSidebarRequest = createLatestRequest();

  const initialLoading = computed(() => loading.value && chartData.value.length === 0 && !weightData.value);
  const refreshing = computed(() => loading.value && !initialLoading.value);

  function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDefaultSingleDate() {
    if (dateStore.selectedDate) return dateStore.selectedDate;
    if (dateStore.dateList.length === 0) return null;

    const today = formatLocalDate(new Date());
    return dateStore.dateList.includes(today) ? today : dateStore.dateList[0];
  }

  function isCompareChartType(type) {
    return ['weight', 'steps', 'heartrate', 'sleep', 'calories'].includes(type);
  }

  function datesKey(dates) {
    return [...dates].sort().join('|');
  }

  async function fetchSleepTimelineForDate(date) {
    const request = sleepRequest.next();
    if (!date) {
      sleepTimelineData.value = null;
      return;
    }

    const timeline = await dataStore.fetchSleepTimeline(date, { signal: request.signal });
    if (request.isCurrent() && dateStore.selectedDate === date && currentChartType.value === 'sleep') {
      sleepTimelineData.value = normalizeSleepTimeline(timeline, date);
    }
  }

  async function fetchCompareSleepTimelines(dates) {
    const request = compareSleepRequest.next();

    if (dates.length === 0) {
      compareSleepTimelineData.value = [];
      return;
    }

    const data = [];
    for (const date of dates) {
      if (!request.isCurrent()) return;
      const timeline = await dataStore.fetchSleepTimeline(date, { signal: request.signal });
      if (timeline) {
        data.push(normalizeSleepTimeline(timeline, date));
      }
    }

    if (!request.isCurrent() || viewMode.value !== 'compare' || currentChartType.value !== 'sleep') {
      return;
    }

    compareSleepTimelineData.value = data.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async function handleChartChange(type) {
    if (type === 'personal' && !dataStore.userProfile) {
      await dataStore.fetchUserProfile();
    }

    currentChartType.value = type;

    if (type === 'sleep' && viewMode.value === 'single' && dateStore.selectedDate) {
      await fetchSleepTimelineForDate(dateStore.selectedDate);
    } else if (type === 'sleep' && viewMode.value === 'compare') {
      await fetchCompareSleepTimelines(dateStore.selectedDates);
    } else if (type !== 'sleep') {
      sleepRequest.cancel();
      compareSleepRequest.cancel();
    }

    if (type === 'weight' && viewMode.value === 'compare') {
      await fetchWeightData();
    }
  }

  async function fetchSingleDayData(date) {
    const request = singleRequest.next();

    if (!date) {
      chartData.value = [];
      loading.value = false;
      return;
    }

    loading.value = true;
    const summary = await dataStore.fetchDailySummary(date, { signal: request.signal });
    if (!request.isCurrent() || viewMode.value !== 'single' || dateStore.selectedDate !== date) {
      return;
    }

    const normalized = normalizeDailySummary(summary || {}, date);
    chartData.value = summary ? [normalized] : [];

    if (request.isCurrent()) {
      loading.value = false;
    }
  }

  async function fetchCompareData(dates, options = {}) {
    const { includeWeightForSidebar = true } = options;
    const request = compareRequest.next();

    if (dates.length === 0) {
      chartData.value = [];
      loading.value = false;
      return;
    }

    loading.value = true;
    const data = [];
    for (const date of dates) {
      if (!request.isCurrent()) return;
      const summary = await dataStore.fetchDailySummary(date, { signal: request.signal });
      if (summary) {
        data.push(normalizeDailySummary(summary, date));
      }
    }
    if (!request.isCurrent() || viewMode.value !== 'compare') {
      return;
    }

    chartData.value = data.sort((a, b) => new Date(a.date) - new Date(b.date));
    loading.value = false;

    if (includeWeightForSidebar) {
      fetchWeightDataForSidebar(dates);
    }
  }

  async function fetchWeightDataForSidebar(dates) {
    const request = weightSidebarRequest.next();
    if (dates.length === 0) return;
    const requestedKey = datesKey(dates);

    try {
      const sorted = [...dates].sort();
      const startDate = sorted[0];
      const endDate = sorted[sorted.length - 1];

      const data = normalizeWeightData(await dataStore.fetchWeightData({ startDate, endDate }, { signal: request.signal }));
      if (!request.isCurrent() || viewMode.value !== 'compare' || requestedKey !== datesKey(dateStore.selectedDates)) {
        return;
      }

      if (data?.dailyData) {
        const weightChartData = data.dailyData.map(item => ({
          date: item.date,
          avgWeight: item.avgWeight
        }));
        if (weightChartData.length > 0) {
          const mergedData = chartData.value.map(item => {
            const weightItem = weightChartData.find(w => w.date === item.date);
            return weightItem ? { ...item, avgWeight: weightItem.avgWeight } : item;
          });
          chartData.value = mergedData;
        }
      }
    } catch (error) {
      console.error('Failed to fetch weight data for sidebar:', error);
    }
  }

  async function fetchWeightData(dates = dateStore.selectedDates) {
    const request = weightRequest.next();
    weightSidebarRequest.cancel();
    if (dates.length === 0) {
      weightData.value = null;
      loading.value = false;
      return;
    }

    try {
      const sorted = [...dates].sort();
      const startDate = sorted[0];
      const endDate = sorted[sorted.length - 1];

      loading.value = true;
      const data = normalizeWeightData(await dataStore.fetchWeightData({ startDate, endDate }, { signal: request.signal }));
      if (!request.isCurrent() || viewMode.value !== 'compare') {
        return;
      }

      weightData.value = data;

      if (data?.dailyData) {
        const weightChartData = data.dailyData.map(item => ({
          date: item.date,
          avgWeight: item.avgWeight
        }));
        if (weightChartData.length > 0) {
          const mergedData = chartData.value.map(item => {
            const weightItem = weightChartData.find(w => w.date === item.date);
            return weightItem ? { ...item, avgWeight: weightItem.avgWeight } : item;
          });
          chartData.value = mergedData;
        }
      }
    } catch (error) {
      console.error('Failed to fetch weight data:', error);
      if (request.isCurrent()) {
        weightData.value = null;
      }
    } finally {
      if (request.isCurrent()) {
        loading.value = false;
      }
    }
  }

  function getLast30Days() {
    const trainingDates = dateStore.trainingDates;
    if (trainingDates.length === 0) return [];

    const sorted = [...trainingDates].sort((a, b) => new Date(b) - new Date(a));
    return sorted.slice(0, 30);
  }

  function initializeCompareSelection() {
    if (dateStore.selectedDateRange[0] && dateStore.selectedDateRange[1]) {
      dateStore.selectDateRange(dateStore.selectedDateRange);
      return dateStore.selectedDates;
    }

    const last30Days = getLast30Days();
    dateStore.setSelectedDates(last30Days);
    return last30Days;
  }

  async function initDefaultData() {
    initializing.value = true;
    loading.value = true;

    try {
      if (dateStore.dateList.length === 0) {
        await dateStore.fetchDateList();
      }

      viewMode.value = 'single';

      const defaultDate = getDefaultSingleDate();
      if (defaultDate) {
        dateStore.selectDate(defaultDate);
        await fetchSingleDayData(defaultDate);
        await dataStore.fetchUserProfile();
        console.log('Loaded single day data for:', defaultDate);
      } else {
        console.warn('No dates available');
      }
    } finally {
      loading.value = false;
      initializing.value = false;
    }
  }

  async function handleImportCompleted() {
    dataStore.clearCache();
    dateStore.clearCache();
    await initDefaultData();
  }

  watch(() => dateStore.selectedDate, async (newDate) => {
    if (initializing.value) return;

    if (viewMode.value === 'single') {
      await fetchSingleDayData(newDate);
      if (currentChartType.value === 'sleep' && newDate) {
        await fetchSleepTimelineForDate(newDate);
      }
    }
  });

  watch(() => dateStore.selectedDates, async (newDates) => {
    if (initializing.value) return;

    if (viewMode.value === 'compare') {
      if (!isCompareChartType(currentChartType.value)) {
        currentChartType.value = 'weight';
      }

      if (currentChartType.value === 'weight') {
        await fetchCompareData(newDates, { includeWeightForSidebar: false });
        await fetchWeightData(newDates);
        compareSleepTimelineData.value = [];
      } else if (currentChartType.value === 'sleep') {
        await fetchCompareData(newDates);
        await fetchCompareSleepTimelines(newDates);
      } else {
        await fetchCompareData(newDates);
      }
    }
  }, { deep: true });

  watch(viewMode, async (newMode) => {
    singleRequest.cancel();
    compareRequest.cancel();
    sleepRequest.cancel();
    compareSleepRequest.cancel();
    weightRequest.cancel();
    weightSidebarRequest.cancel();

    currentChartType.value = newMode === 'single' ? 'personal' : 'weight';
    sleepTimelineData.value = null;
    compareSleepTimelineData.value = [];
    weightData.value = null;

    if (newMode === 'single') {
      if (!dateStore.selectedDate) {
        const defaultDate = getDefaultSingleDate();
        if (defaultDate) {
          dateStore.selectDate(defaultDate);
        }
      }

      if (dateStore.selectedDate) {
        await fetchSingleDayData(dateStore.selectedDate);
      }
    } else {
      const selectedDates = initializeCompareSelection();
      await fetchCompareData(selectedDates);
      await fetchWeightData();
    }
  });

  onMounted(() => {
    initDefaultData();
  });

  return {
    viewMode,
    currentChartType,
    chartData,
    sleepTimelineData,
    compareSleepTimelineData,
    weightData,
    loading,
    initializing,
    initialLoading,
    refreshing,
    handleChartChange,
    handleImportCompleted,
    initDefaultData
  };
}
