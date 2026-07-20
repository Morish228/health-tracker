import { Router } from 'express';
import { runSeed, runSeedSlots } from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middlewares/auth';

const router = Router();

// Admin-only.
router.use(authenticate, requireRole('admin'));

router.post('/seed', runSeed);
router.post('/seed/slots', runSeedSlots);

export default router;
