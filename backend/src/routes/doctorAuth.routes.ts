import { Router } from 'express';
import {
  registerDoctor,
  getMyDoctorProfile,
  updateMyDoctorProfile,
  createMySlots,
  getMySlots,
  deleteMySlot,
  getMyDoctorAppointments,
  completeMyAppointment,
} from '../controllers/doctorAuth.controller';
import { authenticate, requireRole } from '../middlewares/auth';

const router = Router();

// Public: doctor onboarding (D1). Login is shared via /api/auth/login.
router.post('/register', registerDoctor);

// Everything below requires a logged-in doctor.
router.use(authenticate, requireRole('doctor'));

// D5 — own profile
router.get('/me', getMyDoctorProfile);
router.put('/me', updateMyDoctorProfile);

// D2 — own availability slots
router.get('/slots', getMySlots);
router.post('/slots', createMySlots);
router.delete('/slots/:id', deleteMySlot);

// D3 — own appointments
router.get('/appointments', getMyDoctorAppointments);

// D4 — complete appointment with notes/diagnosis
router.patch('/appointments/:id/complete', completeMyAppointment);

export default router;
