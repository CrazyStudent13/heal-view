import express from 'express';
import {
  getDates,
  getDailySummary,
  getTimeSeries,
  getSportRecords,
  getFilterOptions,
  getSleepTimeline
} from '../controllers/dataController.js';
import { getWeightData, getUserProfile } from '../controllers/weightController.js';
import {
  commitImportArchive,
  getImportHistory,
  parseImportArchive,
  removeImportedData,
  removeImportHistory,
  uploadArchive
} from '../controllers/importController.js';
import { getAuthStatus, getSettings, login, logout, saveSettings } from '../controllers/authController.js';
import { requireAccess } from '../middleware/auth.js';
import {
  createTrainingExercise,
  deleteTrainingExercise,
  deleteTrainingExercises,
  getTrainingExercise,
  listTrainingExercises,
  updateTrainingExercise,
  updateTrainingExerciseEnabled,
  updateTrainingExercisesEnabled
} from '../controllers/trainingExerciseController.js';
import {
  createTrainingPhase,
  createTrainingPlan,
  createTrainingPlanWithSessions,
  createTrainingSession,
  deleteTrainingPlan,
  deleteTrainingPhase,
  deleteTrainingSession,
  getTrainingPlan,
  listTrainingPlans,
  listTrainingSessions,
  updateTrainingPhase,
  updateTrainingPlan,
  updateTrainingSession
} from '../controllers/trainingPlanController.js';
import { getChinaWorkdayCalendar } from '../controllers/chinaCalendarController.js';

const router = express.Router();

router.get('/auth/status', getAuthStatus);
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/auth/settings', requireAccess, getSettings);
router.put('/auth/settings', requireAccess, saveSettings);

router.use(requireAccess);

// Get list of dates
router.get('/dates', getDates);

// Get daily summary
router.get('/dates/:date/summary', getDailySummary);

// Get time series data for a metric
router.get('/dates/:date/:metric', getTimeSeries);

// Get sport records
router.get('/sports', getSportRecords);

// Get filter options
router.get('/filters/options', getFilterOptions);

// Get sleep timeline for a specific date
router.get('/sleep/timeline/:date', getSleepTimeline);

// Get weight data with optional date range
router.get('/weight/data', getWeightData);

// Get user profile data
router.get('/user/profile', getUserProfile);

// Training exercise catalog
router.get('/training-exercises', listTrainingExercises);
router.post('/training-exercises', createTrainingExercise);
router.patch('/training-exercises/enabled', updateTrainingExercisesEnabled);
router.delete('/training-exercises', deleteTrainingExercises);
router.get('/training-exercises/:id', getTrainingExercise);
router.put('/training-exercises/:id', updateTrainingExercise);
router.patch('/training-exercises/:id/enabled', updateTrainingExerciseEnabled);
router.delete('/training-exercises/:id', deleteTrainingExercise);

// Training plans, phases, and dated training sessions
router.get('/china-workday-calendar', getChinaWorkdayCalendar);
router.get('/training-plans', listTrainingPlans);
router.post('/training-plans', createTrainingPlan);
router.post('/training-plans/with-sessions', createTrainingPlanWithSessions);
router.get('/training-plans/:id', getTrainingPlan);
router.put('/training-plans/:id', updateTrainingPlan);
router.delete('/training-plans/:id', deleteTrainingPlan);
router.get('/training-sessions', listTrainingSessions);
router.post('/training-plans/:planId/phases', createTrainingPhase);
router.put('/training-phases/:id', updateTrainingPhase);
router.delete('/training-phases/:id', deleteTrainingPhase);
router.post('/training-plans/:planId/sessions', createTrainingSession);
router.put('/training-sessions/:id', updateTrainingSession);
router.delete('/training-sessions/:id', deleteTrainingSession);

// Parse and import health archive ZIP exports
router.post('/imports/parse', uploadArchive.single('archive'), parseImportArchive);
router.get('/imports/history', getImportHistory);
router.delete('/imports/data', removeImportedData);
router.post('/imports/:importId/import', commitImportArchive);
router.delete('/imports/:importId', removeImportHistory);

export default router;
