import { ref, computed, watch, onMounted } from 'vue';
import { useDashboardSelection } from '@/pages/dashboard/composables/useDashboardSelection.js';
import { useDashboardRequests } from '@/pages/dashboard/composables/useDashboardRequests.js';

export function useDashboardData(dateStore, dataStore, options = {}) {
  const active = options.active || ref(true);
  const {
    viewMode,
    currentChartType,
    getDefaultSingleDate,
    isCompareChartType,
    datesKey,
    initializeCompareSelection
  } = useDashboardSelection(dateStore);
  const chartData = ref([]);
  const sleepTimelineData = ref(null);
  const compareSleepTimelineData = ref([]);
  const weightData = ref(null);
  const loading = ref(false);
  const initializing = ref(false);
  let mounted = false;

  const requests = useDashboardRequests({ dateStore, dataStore, viewMode, currentChartType, chartData, sleepTimelineData, compareSleepTimelineData, weightData, loading, datesKey });

  const initialLoading = computed(() => loading.value && chartData.value.length === 0 && !weightData.value);
  const refreshing = computed(() => loading.value && !initialLoading.value);

  async function handleChartChange(type) {
    if (!active.value) return;
    if (type === 'personal' && !dataStore.userProfile) {
      await dataStore.fetchUserProfile();
    }

    currentChartType.value = type;

    if (type === 'sleep' && viewMode.value === 'single' && dateStore.selectedDate) {
      await requests.fetchSleepTimelineForDate(dateStore.selectedDate);
    } else if (type === 'sleep' && viewMode.value === 'compare') {
      await requests.fetchCompareSleepTimelines(dateStore.selectedDates);
    } else if (type !== 'sleep') {
      requests.cancelAll();
    }

    if (type === 'weight' && viewMode.value === 'compare') {
      await requests.fetchWeightData();
    }
  }

  async function initDefaultData() {
    if (!active.value) return;
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
        await requests.fetchSingleDayData(defaultDate);
        await dataStore.fetchUserProfile();
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
    if (!active.value || initializing.value) return;

    if (viewMode.value === 'single') {
        await requests.fetchSingleDayData(newDate);
      if (currentChartType.value === 'sleep' && newDate) {
        await requests.fetchSleepTimelineForDate(newDate);
      }
    }
  });

  watch(() => dateStore.selectedDates, async (newDates) => {
    if (!active.value || initializing.value) return;

    if (viewMode.value === 'compare') {
      if (!isCompareChartType(currentChartType.value)) {
        currentChartType.value = 'weight';
      }

      if (currentChartType.value === 'weight') {
        await requests.fetchCompareData(newDates, { includeWeightForSidebar: false });
        await requests.fetchWeightData(newDates);
        compareSleepTimelineData.value = [];
      } else if (currentChartType.value === 'sleep') {
        await requests.fetchCompareData(newDates);
        await requests.fetchCompareSleepTimelines(newDates);
      } else {
        await requests.fetchCompareData(newDates);
      }
    }
  }, { deep: true });

  watch(viewMode, async (newMode) => {
    if (!active.value) return;
    requests.cancelAll();

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
        await requests.fetchSingleDayData(dateStore.selectedDate);
      }
    } else {
      const selectedDates = initializeCompareSelection();
      await requests.fetchCompareData(selectedDates);
      await requests.fetchWeightData();
    }
  });

  watch(active, isActive => {
    if (!mounted) return;
    if (isActive) {
      dataStore.clearError?.();
      dateStore.clearError?.();
      initDefaultData();
    } else {
      requests.cancelAll();
      loading.value = false;
    }
  });

  onMounted(() => {
    mounted = true;
    if (active.value) {
      dataStore.clearError?.();
      dateStore.clearError?.();
      initDefaultData();
    }
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
