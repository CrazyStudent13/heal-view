import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getFilterOptions } from '../api/fitnessApi.js';
import { useAsyncRequest } from '../composables/useAsyncRequest.js';

export const useFilterStore = defineStore('filter', () => {
  const dateRange = ref([null, null]); // [startDate, endDate]
  const sportTypes = ref([]);
  const selectedSportTypes = ref([]);
  const requestState = useAsyncRequest();

  /**
   * Fetch filter options from API
   */
  async function fetchFilterOptions() {
    return requestState.run(async () => {
      const options = await getFilterOptions();
      sportTypes.value = options.sportTypes || [];
      return sportTypes.value;
    }, { fallback: [] });
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
    loading: requestState.loading,
    error: requestState.error,
    fetchFilterOptions,
    updateDateRange,
    toggleSportType,
    resetFilters
  };
});
