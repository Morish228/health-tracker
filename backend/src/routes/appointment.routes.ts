import express from 'express';
import {
  bookAppointment,
  cancelAppointment,
  completeAppointment,
  getMyAppointments,
} from '../controllers/appointment.controller';
import { authenticate } from '../middlewares/auth';

const router = express.Router();

// Apply auth middleware to all appointment routes
router.use(authenticate);

// GET /api/appointments - Retrieve all appointments for the logged-in patient
router.get('/', getMyAppointments);

// POST /api/appointments - Book a new appointment
router.post('/', bookAppointment);

// PATCH /api/appointments/:id/cancel - Cancel a scheduled appointment
router.patch('/:id/cancel', cancelAppointment);

// PATCH /api/appointments/:id/complete - Mark appointment completed and add notes (simulated action)
router.patch('/:id/complete', completeAppointment);

export default router;
