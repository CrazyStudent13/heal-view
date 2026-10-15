// 兼容层：训练计划控制器已经按职责拆分到 ./trainingPlan/ 下（计划 / 阶段 / 阶段复盘 / 课次
// 四个控制器，加上校验、序列化、状态推导、统计、数据访问几个共享模块）。
// 保留这个文件是因为生产路由 server/src/routes/api.js、tests/server/*.test.js 以及
// tools/seed-mobile-demo.mjs 都仍按这个老路径引入。所有 handler 与 trainingPlanValidation
// 都在这里原样转发，所以这条路径同时也是被测试覆盖最充分的入口。
import {
  createTrainingPlan,
  createTrainingPlanWithSessions,
  deleteTrainingPlan,
  getTrainingPlan,
  listTrainingPlans,
  updateTrainingPlan,
  updateTrainingPlanArchived
} from './trainingPlan/planController.js';
import { createTrainingPhase, deleteTrainingPhase, updateTrainingPhase } from './trainingPlan/phaseController.js';
import { getTrainingPhaseReview, saveTrainingPhaseReview } from './trainingPlan/phaseReviewController.js';
import {
  createTrainingSession,
  createTrainingSessionsBatch,
  deleteTrainingSession,
  listTrainingSessions,
  updateTrainingSession
} from './trainingPlan/sessionController.js';
import {
  isValidDate,
  validatePhasePayload,
  validatePhaseReviewPayload,
  validatePlanPayload,
  validateSessionPayload
} from './trainingPlan/validation.js';

export {
  createTrainingPhase,
  createTrainingPlan,
  createTrainingPlanWithSessions,
  createTrainingSession,
  createTrainingSessionsBatch,
  deleteTrainingPlan,
  deleteTrainingPhase,
  deleteTrainingSession,
  getTrainingPlan,
  getTrainingPhaseReview,
  listTrainingPlans,
  listTrainingSessions,
  saveTrainingPhaseReview,
  updateTrainingPhase,
  updateTrainingPlan,
  updateTrainingPlanArchived,
  updateTrainingSession
};

export const trainingPlanValidation = {
  isValidDate,
  validatePlanPayload,
  validatePhasePayload,
  validateSessionPayload,
  validatePhaseReviewPayload
};
