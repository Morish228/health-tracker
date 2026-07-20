import { Router } from 'express';
import {
  createPrescription,
  getMyPrescriptions,
  getPrescriptionById,
  deletePrescription,
  checkInteractions,
} from '../controllers/prescription.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.post('/', createPrescription);              // T1 + T2 (interaction check on create)
router.get('/', getMyPrescriptions);
router.post('/check-interactions', checkInteractions); // T2 ad-hoc
router.get('/:id', getPrescriptionById);
router.delete('/:id', deletePrescription);

export default router;
