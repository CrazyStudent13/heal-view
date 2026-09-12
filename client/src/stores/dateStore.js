import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getDates, getDailySummary } from '../api/fitnessApi.js';
import { createLatestRequest, normalizeRequestError } from '../utils/requestState.js';

const DATE_LIST_CACHE_TTL = 30_000;

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const useDateStore = defineStore('date', () => {
  const dateList = ref([]);
  const datesWithTraining = ref(new Set()); // Dates that have training data
  const selectedDate = ref(null);
  const selectedDates = ref([]); // For multi-select mode
  const selectedDateRange = ref([null, null]); // For compare mode
  const viewMode = ref('single');
  const loading = ref(false);
  const error = ref(null);
  const dateListRequest = createLatestRequest();
  let dateListPromise = null;
  let dateListFetchedAt = 0;

  // Get first 7 dates (most recent)
  const recentDates = computed(() => {
    return dateList.value.slice(0, 7);
  });

  // Get dates with training data only
  const trainingDates = computed(() => {
    return dateList.value.filter(date => datesWithTraining.value.has(date));
  });

  /**
   * Fetch date list from API and check which have training data
   */
  function fetchDateList(options = {}) {
    const { force = false } = options;
    const cacheIsFresh = dateList.value.length > 0
      && Date.now() - dateListFetchedAt < DATE_LIST_CACHE_TTL;

    if (!force && cacheIsFresh) return dateList.value;
    if (!force && dateListPromise) return dateListPromise;
    if (force) {
      dateListRequest.cancel();
      dateListPromise = null;
    }

    const request = dateListRequest.next();
    loading.value = true;
    error.value = null;

    let currentPromise;
    currentPromise = (async () => {
      try {
        const data = await getDates({ signal: request.signal });
        if (!request.isCurrent()) return dateList.value;

        dateList.value = data.dates || [];

        // Fetch summaries in small batches to reduce the serial wait without flooding the API.
        const summaries = [];
        const batchSize = 8;
        for (let index = 0; index < dateList.value.length; index += batchSize) {
          const batch = dateList.value.slice(index, index + batchSize);
          summaries.push(...await Promise.allSettled(
            batch.map(date => getDailySummary(date, { signal: request.signal }))
          ));
          if (!request.isCurrent()) return dateList.value;
        }
        const trainingSet = new Set();
        summaries.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const summary = result.value;
            if (summary && (summary.steps > 0 || summary.sportCount > 0 || summary.bloodPressureCount > 0)) {
              trainingSet.add(dateList.value[index]);
            }
          } else {
            console.warn(`Failed to check date ${dateList.value[index]}:`, result.reason);
          }
        });
        datesWithTraining.value = trainingSet;
        dateListFetchedAt = Date.now();

        // Auto-select today when available, otherwise use the latest date with data.
        if (dateList.value.length > 0 && !selectedDate.value) {
          const today = formatLocalDate(new Date());
          selectedDate.value = dateList.value.includes(today) ? today : dateList.value[0];
        }
        return dateList.value;
      } catch (err) {
        if (request.isCurrent()) {
          error.value = normalizeRequestError(err);
          console.error('Failed to fetch dates:', err);
        }
        return dateList.value;
      } finally {
        if (request.isCurrent()) {
          loading.value = false;
        }
        if (dateListPromise === currentPromise) dateListPromise = null;
      }
    })();
    dateListPromise = currentPromise;

    return dateListPromise;
  }

  /**
   * Select a date (single mode)
   */
  function selectDate(date) {
    selectedDate.value = date;
  }

  function setViewMode(mode) {
    viewMode.value = mode;
  }

  function selectDateRange(range) {
    const [start, end] = Array.isArray(range) ? range : [];
    const normalizedRange = start && end ? [start, end].sort() : [null, null];
    selectedDateRange.value = normalizedRange;

    if (!normalizedRange[0] || !normalizedRange[1]) {
      selectedDates.value = [];
      return;
    }

    selectedDates.value = trainingDates.value.filter(date => {
      return date >= normalizedRange[0] && date <= normalizedRange[1];
    });
  }

  function syncDateRangeFromSelectedDates() {
    if (selectedDates.value.length === 0) {
      selectedDateRange.value = [null, null];
      return;
    }

    const sorted = [...selectedDates.value].sort();
    selectedDateRange.value = [sorted[0], sorted[sorted.length - 1]];
  }

  function setSelectedDates(dates) {
    selectedDates.value = Array.isArray(dates) ? [...dates] : [];
    syncDateRangeFromSelectedDates();
  }

  /**
   * Toggle date selection (multi mode)
   */
  function toggleDateSelection(date) {
    const index = selectedDates.value.indexOf(date);
    if (index > -1) {
      selectedDates.value.splice(index, 1);
    } else {
      selectedDates.value.push(date);
    }

    syncDateRangeFromSelectedDates();
  }

  /**
   * Select all dates with training data
   */
  function selectAllTrainingDates() {
    setSelectedDates(Array.from(datesWithTraining.value).sort((a, b) =>
      new Date(b) - new Date(a)
    ));
  }

  /**
   * Clear all selected dates
   */
  function clearSelectedDates() {
    selectedDates.value = [];
    selectedDateRange.value = [null, null];
  }

  function clearCache() {
    dateListRequest.cancel();
    dateListPromise = null;
    dateListFetchedAt = 0;
    dateList.value = [];
    datesWithTraining.value = new Set();
    selectedDate.value = null;
    selectedDates.value = [];
    selectedDateRange.value = [null, null];
    error.value = null;
  }

  /**
   * Load more dates (for pagination if needed)
   */
  function loadMoreDates(count = 10) {
    // For now, all dates are already loaded
    // Can implement pagination later if needed
  }

  return {
    dateList,
    datesWithTraining,
    trainingDates,
    selectedDate,
    selectedDates,
    selectedDateRange,
    viewMode,
    loading,
    error,
    recentDates,
    fetchDateList,
    selectDate,
    setViewMode,
    selectDateRange,
    setSelectedDates,
    toggleDateSelection,
    selectAllTrainingDates,
    clearSelectedDates,
    clearCache,
    loadMoreDates
  };
});
