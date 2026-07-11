import express from 'express';
import {
  getDates,
  getDailySummary,
  getTimeSeries,
  getSportRecords,
  getFilterOptions,
  getSleepTimeline
} from '../controllers/dataController.js';
import { getWeightData } from '../controllers/weightController.js';

const router = express.Router();

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

export default router;
