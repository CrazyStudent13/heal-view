import apiClient from './client.js';

/**
 * Get list of dates
 */
export function getDates() {
  return apiClient.get('/dates');
}

/**
 * Get daily summary
 */
export function getDailySummary(date) {
  return apiClient.get(`/dates/${date}/summary`);
}

/**
 * Get time series data
 */
export function getTimeSeries(date, metric) {
  return apiClient.get(`/dates/${date}/${metric}`);
}

/**
 * Get sport records
 */
export function getSportRecords(params = {}) {
  return apiClient.get('/sports', { params });
}

/**
 * Get filter options
 */
export function getFilterOptions() {
  return apiClient.get('/filters/options');
}

/**
 * Get sleep timeline for a specific date
 */
export function getSleepTimeline(date) {
  return apiClient.get(`/sleep/timeline/${date}`);
}

/**
 * Get weight data with optional date range
 */
export function getWeightData(params = {}) {
  return apiClient.get('/weight/data', { params });
}
