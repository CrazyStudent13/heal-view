import apiClient from '@/api/client.js';

/**
 * Get list of dates
 */
export function getDates(config = {}) {
  return apiClient.get('/dates', { timeout: 60000, ...config });
}

/**
 * Get daily summary
 */
export function getDailySummary(date, config = {}) {
  return apiClient.get(`/dates/${date}/summary`, { timeout: 60000, ...config });
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

export function getAuthStatus() {
  return apiClient.get('/auth/status');
}

export function loginWithPassword(password, remember = true) {
  return apiClient.post('/auth/login', { password, remember });
}

export function logout() {
  return apiClient.post('/auth/logout');
}

export function getAccessSettings() {
  return apiClient.get('/auth/settings');
}

export function saveAccessSettings(settings) {
  return apiClient.put('/auth/settings', settings);
}

export function getTrainingExercises(params = {}, config = {}) {
  return apiClient.get('/training-exercises', { ...config, params });
}

export function createTrainingExercise(exercise) {
  return apiClient.post('/training-exercises', exercise);
}

export function updateTrainingExercise(id, exercise) {
  return apiClient.put(`/training-exercises/${id}`, exercise);
}

export function setTrainingExerciseEnabled(id, enabled) {
  return apiClient.patch(`/training-exercises/${id}/enabled`, { enabled });
}

export function setTrainingExercisesEnabled(ids, enabled) {
  return apiClient.patch('/training-exercises/enabled', { ids, enabled });
}

export function deleteTrainingExercise(id) {
  return apiClient.delete(`/training-exercises/${id}`);
}

export function deleteTrainingExercises(ids) {
  return apiClient.delete('/training-exercises', { data: { ids } });
}

export function getTrainingPlans(config = {}) {
  return apiClient.get('/training-plans', config);
}

export function getTrainingPlan(id, config = {}) {
  return apiClient.get(`/training-plans/${id}`, config);
}

export function getTrainingSessions(params = {}, config = {}) {
  return apiClient.get('/training-sessions', { ...config, params });
}

export function getChinaWorkdayCalendar(params, config = {}) {
  return apiClient.get('/china-workday-calendar', { ...config, params });
}

export function createTrainingPlan(plan) {
  return apiClient.post('/training-plans', plan);
}

export function createTrainingPlanWithSessions(payload) {
  return apiClient.post('/training-plans/with-sessions', payload);
}

export function updateTrainingPlan(id, plan) {
  return apiClient.put(`/training-plans/${id}`, plan);
}

export function deleteTrainingPlan(id) {
  return apiClient.delete(`/training-plans/${id}`);
}

export function createTrainingPhase(planId, phase) {
  return apiClient.post(`/training-plans/${planId}/phases`, phase);
}

export function updateTrainingPhase(id, phase) {
  return apiClient.put(`/training-phases/${id}`, phase);
}

export function getTrainingPhaseReview(id, config = {}) {
  return apiClient.get(`/training-phases/${id}/review`, config);
}

export function saveTrainingPhaseReview(id, review) {
  return apiClient.put(`/training-phases/${id}/review`, review);
}

export function deleteTrainingPhase(id) {
  return apiClient.delete(`/training-phases/${id}`);
}

export function createTrainingSession(planId, session) {
  return apiClient.post(`/training-plans/${planId}/sessions`, session);
}

export function createTrainingSessionsBatch(planId, sessions) {
  return apiClient.post(`/training-plans/${planId}/sessions/batch`, { sessions });
}

export function updateTrainingSession(id, session) {
  return apiClient.put(`/training-sessions/${id}`, session);
}

export function deleteTrainingSession(id) {
  return apiClient.delete(`/training-sessions/${id}`);
}

/**
 * 取某一天的全部训练单元，附带逐项目标、已记录的实际值和上一次成绩。
 * 移动端「今日训练」的唯一数据源。
 */
export function getTrainingExecution(date, config = {}) {
  return apiClient.get('/training-execution', { ...config, params: { date } });
}

export function getTrainingExecutionHistory(params = {}, config = {}) {
  return apiClient.get('/training-execution/history', { ...config, params });
}

export function getTrainingSessionExecution(id, config = {}) {
  return apiClient.get(`/training-sessions/${id}/execution`, config);
}

export function saveTrainingSessionExecution(id, execution) {
  return apiClient.put(`/training-sessions/${id}/execution`, execution);
}
