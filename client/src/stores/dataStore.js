import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getDailySummary, getTimeSeries, getSportRecords, getSleepTimeline, getWeightData, getUserProfile } from '../api/fitnessApi.js';
import { isAbortError, normalizeRequestError } from '../utils/requestState.js';

export const useDataStore = defineStore('data', () => {
  const dailySummaries = ref({});
  const timeSeriesData = ref({});
  const sportRecords = ref([]);
  const sleepTimelines = ref({});
  const weightData = ref(null);
  const userProfile = ref(null);
  const loading = ref(false);
  const pendingCount = ref(0);
  const error = ref(null);

  async function runRequest(request, fallback) {
    pendingCount.value += 1;
    loading.value = true;
    error.value = null;

    try {
      return await request();
    } catch (err) {
      if (!isAbortError(err)) {
        error.value = normalizeRequestError(err);
        console.error('Data request failed:', err);
      }
      return fallback;
    } finally {
      pendingCount.value = Math.max(0, pendingCount.value - 1);
      loading.value = pendingCount.value > 0;
    }
  }

  /**
   * Fetch daily summary for a date
   */
  async function fetchDailySummary(date, config = {}) {
    // Return cached data if available
    if (dailySummaries.value[date]) {
      error.value = null;
      return dailySummaries.value[date];
    }

    return runRequest(async () => {
      const summary = await getDailySummary(date, config);
      dailySummaries.value[date] = summary;
      return summary;
    }, null);
  }

  /**
   * Fetch time series data for a date and metric
   */
  async function fetchTimeSeries(date, metric, config = {}) {
    const cacheKey = `${date}_${metric}`;

    // Return cached data if available
    if (timeSeriesData.value[cacheKey]) {
      error.value = null;
      return timeSeriesData.value[cacheKey];
    }

    return runRequest(async () => {
      const data = await getTimeSeries(date, metric, config);
      timeSeriesData.value[cacheKey] = data;
      return data;
    }, null);
  }

  /**
   * Fetch sport records with filters
   */
  async function fetchSportRecords(params = {}, config = {}) {
    return runRequest(async () => {
      const data = await getSportRecords(params, config);
      sportRecords.value = data.records || [];
      return data.records;
    }, []);
  }

  /**
   * Fetch sleep timeline for a date
   */
  async function fetchSleepTimeline(date, config = {}) {
    // Return cached data if available
    if (sleepTimelines.value[date]) {
      error.value = null;
      return sleepTimelines.value[date];
    }

    return runRequest(async () => {
      const timeline = await getSleepTimeline(date, config);
      sleepTimelines.value[date] = timeline;
      return timeline;
    }, null);
  }

  /**
   * Fetch weight data with optional date range
   */
  async function fetchWeightData(params = {}, config = {}) {
    return runRequest(async () => {
      const data = await getWeightData(params, config);
      weightData.value = data;
      return data;
    }, null);
  }

  /**
   * Fetch user profile data
   */
  async function fetchUserProfile(config = {}) {
    // Return cached data if available
    if (userProfile.value) {
      error.value = null;
      return userProfile.value;
    }

    return runRequest(async () => {
      const data = await getUserProfile(config);
      userProfile.value = data;
      return data;
    }, null);
  }

  /**
   * Clear cache
   */
  function clearCache() {
    dailySummaries.value = {};
    timeSeriesData.value = {};
    sportRecords.value = [];
    sleepTimelines.value = {};
    weightData.value = null;
    userProfile.value = null;
    pendingCount.value = 0;
    loading.value = false;
    error.value = null;
  }

  return {
    dailySummaries,
    timeSeriesData,
    sportRecords,
    sleepTimelines,
    weightData,
    userProfile,
    loading,
    pendingCount,
    error,
    fetchDailySummary,
    fetchTimeSeries,
    fetchSportRecords,
    fetchSleepTimeline,
    fetchWeightData,
    fetchUserProfile,
    clearCache
  };
});
