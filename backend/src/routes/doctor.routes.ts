import express from 'express';
import {
  getDoctors,
  getDoctorById,
  getDoctorSlots,
} from '../controllers/doctor.controller';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// Apply auth middleware to all doctor and slot query routes
router.use(authenticate);

// GET /api/doctors - List all doctors (with optional ?specialization= query)
router.get('/', getDoctors);

// GET /api/doctors/:id - Get detailed profile for a specific doctor
router.get('/:id', getDoctorById);

// GET /api/doctors/:id/slots - Get available slots for a specific doctor on a specific date
router.get('/:id/slots', getDoctorSlots);

export default router;
