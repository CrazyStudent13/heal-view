import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getDates, getDailySummary } from '../api/fitnessApi.js';

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
  const loading = ref(false);
  const error = ref(null);

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
  async function fetchDateList() {
    loading.value = true;
    error.value = null;

    try {
      const data = await getDates();
      dateList.value = data.dates || [];

      // Check which dates have training data (steps > 0 or sportCount > 0)
      const trainingSet = new Set();
      for (const date of dateList.value) {
        try {
          const summary = await getDailySummary(date);
          if (summary && (summary.steps > 0 || summary.sportCount > 0)) {
            trainingSet.add(date);
          }
        } catch (err) {
          console.warn(`Failed to check date ${date}:`, err);
        }
      }
      datesWithTraining.value = trainingSet;

      // Auto-select today when available, otherwise use the latest date with data.
      if (dateList.value.length > 0 && !selectedDate.value) {
        const today = formatLocalDate(new Date());
        selectedDate.value = dateList.value.includes(today) ? today : dateList.value[0];
      }
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch dates:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Select a date (single mode)
   */
  function selectDate(date) {
    selectedDate.value = date;
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
  }

  /**
   * Select all dates with training data
   */
  function selectAllTrainingDates() {
    selectedDates.value = Array.from(datesWithTraining.value).sort((a, b) => 
      new Date(b) - new Date(a)
    );
  }

  /**
   * Clear all selected dates
   */
  function clearSelectedDates() {
    selectedDates.value = [];
  }

  function clearCache() {
    dateList.value = [];
    datesWithTraining.value = new Set();
    selectedDate.value = null;
    selectedDates.value = [];
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
    loading,
    error,
    recentDates,
    fetchDateList,
    selectDate,
    toggleDateSelection,
    selectAllTrainingDates,
    clearSelectedDates,
    clearCache,
    loadMoreDates
  };
});
