import { Router } from 'express';
import {
  inviteCaregiver,
  getMyInvites,
  acceptInvite,
  getMyPatients,
  getPatientVitals,
  getPatientAdherence,
  getPatientAppointments,
  bookForPatient,
} from '../controllers/caregiver.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

// Patient side
router.post('/invite', inviteCaregiver);              // goal 29 (patient invites)

// Caregiver side
router.get('/invites', getMyInvites);                 // pending invitations for me
router.patch('/invites/:id/accept', acceptInvite);    // goal 29 (accept)
router.get('/patients', getMyPatients);               // patients I care for

// Caregiver read-only views (goal 30)
router.get('/patients/:patientId/vitals', getPatientVitals);
router.get('/patients/:patientId/adherence', getPatientAdherence);
router.get('/patients/:patientId/appointments', getPatientAppointments);

// Caregiver books on behalf (goal 32)
router.post('/book', bookForPatient);

export default router;
