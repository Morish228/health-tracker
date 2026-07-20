import { Response } from 'express';
import mongoose from 'mongoose';
import { CaregiverPatient } from '../models/CaregiverPatient';
import { User } from '../models/User';
import { Profile } from '../models/Profile';
import { VitalLog } from '../models/VitalLog';
import { AdherenceLog } from '../models/AdherenceLog';
import { Appointment } from '../models/Appointment';
import { AvailabilitySlot } from '../models/AvailabilitySlot';
import { AuthRequest } from '../middlewares/auth';
import { notifyUser } from '../services/notification';

/**
 * Goal 29 — Patient invites a family member as caregiver (by email).
 * If the email belongs to a registered user we link caregiverId immediately (still PENDING
 * until they accept). Otherwise we keep the invite by email for them to accept after signup.
 */
export const inviteCaregiver = async (req: AuthRequest, res: Response) => {
  try {
    const { email, permissions } = req.body;
    const patientId = req.userId;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Caregiver email is required' });
    }

    const caregiverUser = await User.findOne({ email: email.toLowerCase() });

    const link = await CaregiverPatient.findOneAndUpdate(
      { patientId, inviteEmail: email.toLowerCase() },
      {
        patientId,
        inviteEmail: email.toLowerCase(),
        caregiverId: caregiverUser?._id,
        status: 'PENDING',
        ...(permissions ? { permissions } : {}),
      },
      { new: true, upsert: true }
    );

    // If the caregiver already has an account, drop them an in-app invite.
    if (caregiverUser) {
      await notifyUser(caregiverUser._id.toString(), {
        type: 'CAREGIVER_INVITE',
        title: 'Caregiver invitation',
        body: 'A patient invited you to be their caregiver. Open your invitations to accept.',
        meta: { linkId: link._id },
      });
    }

    res.status(201).json({ success: true, message: 'Caregiver invited', data: link });
  } catch (error: any) {
    console.error('Invite caregiver error:', error);
    res.status(500).json({ success: false, message: 'Failed to invite caregiver', error: error.message });
  }
};

/** Invitations addressed to the logged-in caregiver (by linked id or matching email). */
export const getMyInvites = async (req: AuthRequest, res: Response) => {
  try {
    const me = await User.findById(req.userId).select('email');
    const invites = await CaregiverPatient.find({
      status: 'PENDING',
      $or: [{ caregiverId: req.userId }, { inviteEmail: me?.email }],
    }).populate('patientId', 'email');
    res.status(200).json({ success: true, data: invites });
  } catch (error: any) {
    console.error('Get invites error:', error);
    res.status(500).json({ success: false, message: 'Failed to load invites', error: error.message });
  }
};

/** Goal 29 — caregiver accepts an invitation. Binds caregiverId if it was email-only. */
export const acceptInvite = async (req: AuthRequest, res: Response) => {
  try {
    const me = await User.findById(req.userId).select('email');
    const link = await CaregiverPatient.findById(req.params.id);

    if (!link || link.status !== 'PENDING') {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }
    // The accepting user must be the invited caregiver (by id or email).
    const isMine =
      (link.caregiverId && link.caregiverId.toString() === req.userId) ||
      link.inviteEmail === me?.email;
    if (!isMine) {
      return res.status(403).json({ success: false, message: 'This invitation is not for you' });
    }

    link.caregiverId = new mongoose.Types.ObjectId(req.userId);
    link.status = 'ACCEPTED';
    await link.save();

    res.status(200).json({ success: true, message: 'Invitation accepted', data: link });
  } catch (error: any) {
    console.error('Accept invite error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept invitation', error: error.message });
  }
};

/** Patients this caregiver is linked to (accepted). */
export const getMyPatients = async (req: AuthRequest, res: Response) => {
  try {
    const links = await CaregiverPatient.find({ caregiverId: req.userId, status: 'ACCEPTED' })
      .populate('patientId', 'email');
    res.status(200).json({ success: true, data: links });
  } catch (error: any) {
    console.error('Get my patients error:', error);
    res.status(500).json({ success: false, message: 'Failed to load patients', error: error.message });
  }
};

/**
 * Guard: confirm the logged-in caregiver has an ACCEPTED link to `patientId` and (optionally)
 * the given permission. Returns the link or null.
 */
const assertLinked = async (caregiverId: string | undefined, patientId: string, perm?: string) => {
  const link = await CaregiverPatient.findOne({
    caregiverId,
    patientId,
    status: 'ACCEPTED',
  });
  if (!link) return null;
  if (perm && !link.permissions.includes(perm)) return null;
  return link;
};

/** Goal 30 — caregiver read-only view of a patient's vitals. */
export const getPatientVitals = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    if (!(await assertLinked(req.userId, patientId, 'vitals'))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this patient\'s vitals' });
    }
    const vitals = await VitalLog.find({ patientId }).sort({ recordedAt: -1 }).limit(100);
    res.status(200).json({ success: true, data: vitals });
  } catch (error: any) {
    console.error('Caregiver get vitals error:', error);
    res.status(500).json({ success: false, message: 'Failed to load vitals', error: error.message });
  }
};

/** Goal 30 — caregiver read-only view of a patient's adherence logs. */
export const getPatientAdherence = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    if (!(await assertLinked(req.userId, patientId, 'adherence'))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this patient\'s adherence' });
    }
    const logs = await AdherenceLog.find({ patientId }).sort({ date: -1 }).limit(100);
    res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    console.error('Caregiver get adherence error:', error);
    res.status(500).json({ success: false, message: 'Failed to load adherence', error: error.message });
  }
};

/** Goal 30 — caregiver read-only view of a patient's appointments. */
export const getPatientAppointments = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    if (!(await assertLinked(req.userId, patientId, 'appointments'))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this patient\'s appointments' });
    }
    const appointments = await Appointment.find({ patientId })
      .populate('doctorId', 'name specialization')
      .populate('slotId', 'date startTime endTime')
      .sort({ dateTime: -1 });
    res.status(200).json({ success: true, data: appointments });
  } catch (error: any) {
    console.error('Caregiver get appointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to load appointments', error: error.message });
  }
};

/**
 * Goal 32 — caregiver books an appointment on behalf of a linked patient.
 * Same double-booking protection as the patient's own booking.
 */
export const bookForPatient = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { patientId, slotId, symptoms } = req.body;

    if (!patientId || !slotId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'patientId and slotId are required' });
    }

    // Verify the caregiver link (outside the txn read is fine).
    if (!(await assertLinked(req.userId, patientId, 'appointments'))) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Not authorized to book for this patient' });
    }

    const slot = await AvailabilitySlot.findById(slotId).session(session);
    if (!slot) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Availability slot not found' });
    }
    if (slot.status !== 'AVAILABLE') {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ success: false, message: 'This slot is already taken or blocked' });
    }

    slot.status = 'TAKEN';
    await slot.save({ session });

    const slotDate = new Date(slot.date);
    const [hours, minutes] = slot.startTime.split(':').map(Number);
    slotDate.setHours(hours, minutes, 0, 0);

    const [appointment] = await Appointment.create(
      [{ patientId, doctorId: slot.doctorId, slotId: slot._id, dateTime: slotDate, status: 'SCHEDULED', symptoms }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Let the patient know a caregiver booked for them.
    await notifyUser(patientId, {
      type: 'APPOINTMENT',
      title: 'Appointment booked by your caregiver',
      body: `A caregiver booked an appointment for you on ${slotDate.toLocaleString()}.`,
      meta: { appointmentId: appointment._id },
    });

    res.status(201).json({ success: true, message: 'Appointment booked for patient', data: appointment });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Book for patient error:', error);
    res.status(500).json({ success: false, message: 'Failed to book for patient', error: error.message });
  }
};
