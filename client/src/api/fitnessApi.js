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

/**
 * 计划列表。归档是一种"我不想再看到它"的意图，默认不返回已归档计划，
 * 需要显式传 includeArchived 才带上（服务端会把这些计划排在最后）。
 */
export function getTrainingPlans(params = {}, config = {}) {
  return apiClient.get('/training-plans', { ...config, params });
}

export function getTrainingPlan(id, config = {}) {
  return apiClient.get(`/training-plans/${id}`, config);
}

/**
 * 全局训练单元列表。status 只接受完成状态（achieved / partial / skipped / missed），
 * logged 是打卡状态（'true' 已打卡 / 'false' 未打卡），search 只匹配训练内容（单元里的训练项目名）；
 * 几个条件是 AND 关系。服务端按读取时推导的状态过滤，所以筛选、total 和分页是同一份结果。
 * 返回里的 executionCount 是匹配结果中已有打卡记录的条数，删除前用它提示会连带消失的记录。
 */
export function getTrainingSessions(params = {}, config = {}) {
  return apiClient.get('/training-sessions', { ...config, params });
}

/** 按勾选的训练单元 id 批量删除；训练项目和打卡记录由服务端级联清理。 */
export function deleteTrainingSessions(ids) {
  return apiClient.delete('/training-sessions', { data: { ids } });
}

/**
 * 按复合筛选条件批量删除（"删掉筛选结果"）。
 * 服务端用和列表完全相同的条件重新求交，所以不依赖客户端把跨页的 id 全捞回来；
 * expectedCount 是确认弹窗里给用户看的那个条数，服务端求交后对不上就返回 409 拒绝执行。
 */
export function deleteTrainingSessionsByFilter(filter, expectedCount) {
  return apiClient.delete('/training-sessions', { data: { filter, expectedCount } });
}

/**
 * 训练单元内"训练内容"（训练项目）的删除预览。
 * filter 的字段和列表完全一致（日期区间 / 计划 / 完成状态 / 打卡状态 / 训练内容关键词），
 * 所以它数出来的就是当前列表上那批训练单元里的、某个训练项目的条数。
 */
export function getTrainingSessionItemDeletePreview(params = {}, config = {}) {
  return apiClient.get('/training-session-items/delete-preview', { ...config, params });
}

/**
 * 批量删除训练内容。两种入参互斥：
 * - `{ ids }`：删掉明确点选的几条（列表展开行里的单条删除）；
 * - `{ exerciseId, filter, expectedCount }`：在筛选出的训练单元里删掉某个训练项目的全部记录。
 * 只剩最后一个项目的训练单元会被跳过（服务端回报 skippedCount），不会留下空单元。
 */
export function deleteTrainingSessionItems(payload) {
  return apiClient.delete('/training-session-items', { data: payload });
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

/** 归档 / 取消归档。归档位与由日期推导的生命周期正交，所以单独一个端点。 */
export function setTrainingPlanArchived(id, archived) {
  return apiClient.patch(`/training-plans/${id}/archived`, { archived });
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
