import { Router } from 'express';
import {
  createReminder,
  createRemindersForPrescription,
  getMyReminders,
  updateReminder,
  deleteReminder,
} from '../controllers/reminder.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getMyReminders);
router.post('/', createReminder);
router.post('/for-prescription', createRemindersForPrescription);
router.put('/:id', updateReminder);
router.delete('/:id', deleteReminder);

// Note: the "due today" checklist lives at GET /api/adherence/today (computed from these schedules).

export default router;
