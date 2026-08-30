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

/**
 * Get user profile data
 */
export function getUserProfile() {
  return apiClient.get('/user/profile');
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
