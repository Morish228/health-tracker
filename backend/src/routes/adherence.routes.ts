import express from 'express';
import {
  logDose,
  getTodayStatus,
  getStreakCount,
  getMissedDoses,
} from '../controllers/adherence.controller';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// Apply auth middleware to all adherence routes
router.use(authenticate);

// GET /api/adherence/today - Get checklist of medications scheduled and logged for today
router.get('/today', getTodayStatus);

// GET /api/adherence/streak - Get the current streak of complete daily adherence
router.get('/streak', getStreakCount);

// GET /api/adherence/missed - Get history logs marked as missed/untaken
router.get('/missed', getMissedDoses);

// POST /api/adherence/log - Check or uncheck a medication dose
router.post('/log', logDose);

export default router;
