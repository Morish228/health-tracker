import { Router } from 'express';
import { triggerSOS, getMyAlerts, updateAlertStatus } from '../controllers/emergency.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.post('/sos', triggerSOS);              // goals 23-24
router.get('/alerts', getMyAlerts);
router.patch('/alerts/:id/status', updateAlertStatus);

export default router;
