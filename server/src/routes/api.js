import express from 'express';
import { createRequire } from 'node:module';
import { apiReference } from '@scalar/express-api-reference';
import { openApiDocument } from '../docs/openapi.js';
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
  createTrainingSessionsBatch,
  deleteTrainingPlan,
  deleteTrainingPhase,
  deleteTrainingSession,
  deleteTrainingSessions,
  getTrainingPlan,
  getTrainingPhaseReview,
  listTrainingPlans,
  listTrainingSessions,
  saveTrainingPhaseReview,
  updateTrainingPhase,
  updateTrainingPlan,
  updateTrainingPlanArchived,
  updateTrainingSession
} from '../controllers/trainingPlanController.js';
import { getChinaWorkdayCalendar } from '../controllers/chinaCalendarController.js';
import {
  deleteTrainingSessionItems,
  previewTrainingSessionItemDeletion
} from '../controllers/trainingPlan/sessionItemController.js';
import {
  getTrainingExecution,
  getTrainingExecutionHistory,
  getTrainingSessionExecution,
  saveTrainingSessionExecution
} from '../controllers/trainingExecutionController.js';

const require = createRequire(import.meta.url);
// Redoc 的 standalone bundle 随依赖一起安装，文档页不依赖外网 CDN。
const redocStandalonePath = require.resolve('redoc/bundles/redoc.standalone.js');
const REDOC_PAGE = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Heal View API · Redoc</title>
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <redoc spec-url="/api/openapi.json"></redoc>
    <script type="module" src="/api/redoc/redoc.standalone.js"></script>
  </body>
</html>`;

const router = express.Router();

router.get('/auth/status', getAuthStatus);
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/auth/settings', requireAccess, getSettings);
router.put('/auth/settings', requireAccess, saveSettings);

// The mobile check-in is a personal daily workflow and can be opened without
// entering the desktop application's access password. Keep this small surface
// explicit; all planning, health data, and import APIs remain protected below.
router.get('/training-execution', getTrainingExecution);
router.get('/training-sessions/:id/execution', getTrainingSessionExecution);
router.put('/training-sessions/:id/execution', saveTrainingSessionExecution);

router.use(requireAccess);

// 接口文档：开启访问保护后同样需要登录。JSON 给脚本 / AI 读，页面给人看。
// 主入口用 Scalar（阅读 + 调试一体），Redoc 作为只读、离线可用的备用页面。
router.get('/openapi.json', (req, res) => res.json(openApiDocument));
router.get('/redoc/redoc.standalone.js', (req, res) =>
  // pnpm 的依赖路径里带 .pnpm 目录，sendFile 默认把点开头的目录当 dotfile 拒掉。
  res.sendFile(redocStandalonePath, { dotfiles: 'allow' })
);
router.get('/redoc', (req, res) => res.type('html').send(REDOC_PAGE));
router.get(
  '/docs',
  apiReference({
    url: '/api/openapi.json',
    pageTitle: 'Heal View API',
    // 固定版本，避免 CDN 上的 latest 变更把文档页打挂。
    bundle: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.75.0/esm.js'
  })
);

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
router.patch('/training-plans/:id/archived', updateTrainingPlanArchived);
router.delete('/training-plans/:id', deleteTrainingPlan);
router.get('/training-sessions', listTrainingSessions);
// 批量删除：按显式 ids 或按和列表相同的复合条件（"删掉筛选结果"）。
router.delete('/training-sessions', deleteTrainingSessions);
// 训练单元内的训练项目批量删除：预览 + 删除（按项目 id 或"某个训练项目 + 同一套单元条件"）。
router.get('/training-session-items/delete-preview', previewTrainingSessionItemDeletion);
router.delete('/training-session-items', deleteTrainingSessionItems);
router.post('/training-plans/:planId/phases', createTrainingPhase);
router.put('/training-phases/:id', updateTrainingPhase);
router.get('/training-phases/:id/review', getTrainingPhaseReview);
router.put('/training-phases/:id/review', saveTrainingPhaseReview);
router.delete('/training-phases/:id', deleteTrainingPhase);
router.post('/training-plans/:planId/sessions', createTrainingSession);
router.post('/training-plans/:planId/sessions/batch', createTrainingSessionsBatch);
router.put('/training-sessions/:id', updateTrainingSession);
router.delete('/training-sessions/:id', deleteTrainingSession);

// Manual training execution records for the mobile check-in flow
router.get('/training-execution/history', getTrainingExecutionHistory);

// Parse and import health archive ZIP exports
router.post('/imports/parse', uploadArchive.single('archive'), parseImportArchive);
router.get('/imports/history', getImportHistory);
router.delete('/imports/data', removeImportedData);
router.post('/imports/:importId/import', commitImportArchive);
router.delete('/imports/:importId', removeImportHistory);

export default router;
