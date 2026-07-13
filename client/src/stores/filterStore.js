import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getFilterOptions } from '../api/fitnessApi.js';

export const useFilterStore = defineStore('filter', () => {
  const dateRange = ref([null, null]); // [startDate, endDate]
  const sportTypes = ref([]);
  const selectedSportTypes = ref([]);
  const loading = ref(false);
  const error = ref(null);

  /**
   * Fetch filter options from API
   */
  async function fetchFilterOptions() {
    loading.value = true;
    error.value = null;

    try {
      const options = await getFilterOptions();
      sportTypes.value = options.sportTypes || [];
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch filter options:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Update date range
   */
  function updateDateRange(range) {
    dateRange.value = range;
  }

  /**
   * Toggle sport type selection
   */
  function toggleSportType(type) {
    const index = selectedSportTypes.value.indexOf(type);
    if (index > -1) {
      selectedSportTypes.value.splice(index, 1);
    } else {
      selectedSportTypes.value.push(type);
    }
  }

  /**
   * Reset all filters
   */
  function resetFilters() {
    dateRange.value = [null, null];
    selectedSportTypes.value = [];
  }

  return {
    dateRange,
    sportTypes,
    selectedSportTypes,
    loading,
    error,
    fetchFilterOptions,
    updateDateRange,
    toggleSportType,
    resetFilters
  };
});
