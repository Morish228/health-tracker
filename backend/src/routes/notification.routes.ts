import { Router } from 'express';
import { getMyNotifications, markRead, markAllRead } from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.get('/', getMyNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
