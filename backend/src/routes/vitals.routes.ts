import express from 'express';
import {
  logVital,
  getVitalHistory,
  getLatestPerType,
  upsertThresholds,
  getThresholds,
} from '../controllers/vitals.controller';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// Apply auth middleware to all vitals routes
router.use(authenticate);

// GET /api/vitals/latest - Retrieve the most recent log for every vital type
router.get('/latest', getLatestPerType);

// GET /api/vitals/history - Get date-filtered historical logs for a vital type
router.get('/history', getVitalHistory);

// GET /api/vitals/thresholds - Get configured safety thresholds
router.get('/thresholds', getThresholds);

// POST /api/vitals/thresholds - Configure or update safety thresholds
router.post('/thresholds', upsertThresholds);

// POST /api/vitals - Log a new vital measurement
router.post('/', logVital);

export default router;
