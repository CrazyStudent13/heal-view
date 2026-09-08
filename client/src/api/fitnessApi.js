import apiClient from './client.js';

/**
 * Get list of dates
 */
export function getDates(config = {}) {
  return apiClient.get('/dates', config);
}

/**
 * Get daily summary
 */
export function getDailySummary(date, config = {}) {
  return apiClient.get(`/dates/${date}/summary`, config);
}

/**
 * Get time series data
 */
export function getTimeSeries(date, metric, config = {}) {
  return apiClient.get(`/dates/${date}/${metric}`, config);
}

/**
 * Get sport records
 */
export function getSportRecords(params = {}, config = {}) {
  return apiClient.get('/sports', { ...config, params });
}

/**
 * Get filter options
 */
export function getFilterOptions(config = {}) {
  return apiClient.get('/filters/options', config);
}

/**
 * Get sleep timeline for a specific date
 */
export function getSleepTimeline(date, config = {}) {
  return apiClient.get(`/sleep/timeline/${date}`, config);
}

/**
 * Get weight data with optional date range
 */
export function getWeightData(params = {}, config = {}) {
  return apiClient.get('/weight/data', { ...config, params });
}

/**
 * Get user profile data
 */
export function getUserProfile(config = {}) {
  return apiClient.get('/user/profile', config);
}

/**
 * Parse a health archive ZIP before importing it into the database
 */
export function parseImportArchive(file, platform) {
  const formData = new FormData();
  formData.append('platform', platform);
  formData.append('archive', file);
  return apiClient.post('/imports/parse', formData, { timeout: 120000 });
}

/**
 * Commit a previously parsed archive into the database
 */
export function commitImportArchive(importId) {
  return apiClient.post(`/imports/${importId}/import`, undefined, { timeout: 120000 });
}

/**
 * Get in-memory import history for the current server session
 */
export function getImportHistory() {
  return apiClient.get('/imports/history');
}

/**
 * Remove one import history item
 */
export function deleteImportHistory(importId) {
  return apiClient.delete(`/imports/${importId}`);
}

/**
 * Clear imported dashboard data
 */
export function clearImportedData() {
  return apiClient.delete('/imports/data', { timeout: 120000 });
}
