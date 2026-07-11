import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getDailySummary, getTimeSeries, getSportRecords, getSleepTimeline, getWeightData, getUserProfile } from '../api/fitnessApi.js';

export const useDataStore = defineStore('data', () => {
  const dailySummaries = ref({});
  const timeSeriesData = ref({});
  const sportRecords = ref([]);
  const sleepTimelines = ref({});
  const weightData = ref(null);
  const userProfile = ref(null);
  const loading = ref(false);
  const error = ref(null);

  /**
   * Fetch daily summary for a date
   */
  async function fetchDailySummary(date) {
    // Return cached data if available
    if (dailySummaries.value[date]) {
      return dailySummaries.value[date];
    }

    loading.value = true;
    error.value = null;

    try {
      const summary = await getDailySummary(date);
      dailySummaries.value[date] = summary;
      return summary;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch daily summary:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch time series data for a date and metric
   */
  async function fetchTimeSeries(date, metric) {
    const cacheKey = `${date}_${metric}`;

    // Return cached data if available
    if (timeSeriesData.value[cacheKey]) {
      return timeSeriesData.value[cacheKey];
    }

    loading.value = true;
    error.value = null;

    try {
      const data = await getTimeSeries(date, metric);
      timeSeriesData.value[cacheKey] = data;
      return data;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch time series:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch sport records with filters
   */
  async function fetchSportRecords(params = {}) {
    loading.value = true;
    error.value = null;

    try {
      const data = await getSportRecords(params);
      sportRecords.value = data.records || [];
      return data.records;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch sport records:', err);
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch sleep timeline for a date
   */
  async function fetchSleepTimeline(date) {
    // Return cached data if available
    if (sleepTimelines.value[date]) {
      return sleepTimelines.value[date];
    }

    loading.value = true;
    error.value = null;

    try {
      const timeline = await getSleepTimeline(date);
      sleepTimelines.value[date] = timeline;
      return timeline;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch sleep timeline:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch weight data with optional date range
   */
  async function fetchWeightData(params = {}) {
    loading.value = true;
    error.value = null;

    try {
      const data = await getWeightData(params);
      weightData.value = data;
      return data;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch weight data:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch user profile data
   */
  async function fetchUserProfile() {
    // Return cached data if available
    if (userProfile.value) {
      return userProfile.value;
    }

    loading.value = true;
    error.value = null;

    try {
      const data = await getUserProfile();
      userProfile.value = data;
      return data;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch user profile:', err);
      return null;
    } finally {
      loading.value = false;
    }
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
  }

  return {
    dailySummaries,
    timeSeriesData,
    sportRecords,
    sleepTimelines,
    weightData,
    userProfile,
    loading,
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
