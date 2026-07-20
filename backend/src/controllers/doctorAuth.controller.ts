import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Doctor } from '../models/Doctor';
import { AvailabilitySlot } from '../models/AvailabilitySlot';
import { Appointment } from '../models/Appointment';
import { AuthRequest } from '../middlewares/auth';

/**
 * D1 — Doctor registration/onboarding.
 * Creates a User(role:'doctor') and a linked Doctor profile in one transaction.
 * Login afterwards uses the normal /api/auth/login (role travels in the JWT).
 */
export const registerDoctor = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { email, password, name, specialization, qualifications, contact, hospitalId } = req.body;

    if (!email || !password || !name || !specialization) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'email, password, name, and specialization are required',
      });
    }

    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create the auth account (mark verified false — real credential checks are out of scope)
    const [user] = await User.create(
      [{ email, passwordHash, role: 'doctor' }],
      { session }
    );

    // Create the doctor profile linked to that account
    const [doctor] = await Doctor.create(
      [{
        userId: user._id,
        name,
        specialization,
        qualifications,
        contact,
        hospitalId: hospitalId || undefined,
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Doctor registered successfully',
      data: { userId: user._id, doctorId: doctor._id, email: user.email },
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Register doctor error:', error);
    res.status(500).json({ success: false, message: 'Doctor registration failed', error: error.message });
  }
};

/** Helper: resolve the Doctor profile for the logged-in doctor user. */
const getDoctorForUser = async (userId?: string) => {
  return Doctor.findOne({ userId });
};

/**
 * D5 — Doctor views/edits own profile.
 */
export const getMyDoctorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const doctor = await getDoctorForUser(req.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    res.status(200).json({ success: true, data: doctor });
  } catch (error: any) {
    console.error('Get doctor profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to load doctor profile', error: error.message });
  }
};

export const updateMyDoctorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { name, specialization, qualifications, contact, hospitalId } = req.body;
    const doctor = await Doctor.findOneAndUpdate(
      { userId: req.userId },
      { name, specialization, qualifications, contact, hospitalId },
      { new: true, omitUndefined: true }
    );
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    res.status(200).json({ success: true, message: 'Profile updated', data: doctor });
  } catch (error: any) {
    console.error('Update doctor profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
};

/**
 * D2 — Doctor manages own availability slots.
 * Create one or many slots. Body: { date, startTime, endTime } or { slots: [...] }.
 */
export const createMySlots = async (req: AuthRequest, res: Response) => {
  try {
    const doctor = await getDoctorForUser(req.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }

    // Accept either a single slot or an array under `slots`
    const incoming = Array.isArray(req.body.slots) ? req.body.slots : [req.body];

    const toCreate = [];
    for (const s of incoming) {
      if (!s.date || !s.startTime || !s.endTime) {
        return res.status(400).json({
          success: false,
          message: 'Each slot requires date, startTime, and endTime',
        });
      }
      toCreate.push({
        doctorId: doctor._id,
        date: new Date(s.date),
        startTime: s.startTime,
        endTime: s.endTime,
        status: 'AVAILABLE',
      });
    }

    // insertMany with ordered:false so a duplicate (same doctor/date/time) doesn't abort the rest
    const created = await AvailabilitySlot.insertMany(toCreate, { ordered: false }).catch((e: any) => {
      // Partial success is fine; surface what got inserted
      if (e?.insertedDocs) return e.insertedDocs;
      throw e;
    });

    res.status(201).json({ success: true, message: 'Slots created', data: created });
  } catch (error: any) {
    console.error('Create slots error:', error);
    res.status(500).json({ success: false, message: 'Failed to create slots', error: error.message });
  }
};

export const getMySlots = async (req: AuthRequest, res: Response) => {
  try {
    const doctor = await getDoctorForUser(req.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    const slots = await AvailabilitySlot.find({ doctorId: doctor._id }).sort({ date: 1, startTime: 1 });
    res.status(200).json({ success: true, data: slots });
  } catch (error: any) {
    console.error('Get my slots error:', error);
    res.status(500).json({ success: false, message: 'Failed to load slots', error: error.message });
  }
};

/** Delete a slot the doctor owns (only if not already TAKEN). */
export const deleteMySlot = async (req: AuthRequest, res: Response) => {
  try {
    const doctor = await getDoctorForUser(req.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    const slot = await AvailabilitySlot.findOne({ _id: req.params.id, doctorId: doctor._id });
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    if (slot.status === 'TAKEN') {
      return res.status(409).json({ success: false, message: 'Cannot delete a booked slot' });
    }
    await slot.deleteOne();
    res.status(200).json({ success: true, message: 'Slot deleted' });
  } catch (error: any) {
    console.error('Delete slot error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete slot', error: error.message });
  }
};

/**
 * D3 — Doctor views own appointments.
 */
export const getMyDoctorAppointments = async (req: AuthRequest, res: Response) => {
  try {
    const doctor = await getDoctorForUser(req.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    const appointments = await Appointment.find({ doctorId: doctor._id })
      .populate('patientId', 'email')
      .populate('slotId', 'date startTime endTime')
      .sort({ dateTime: -1 });
    res.status(200).json({ success: true, data: appointments });
  } catch (error: any) {
    console.error('Get doctor appointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to load appointments', error: error.message });
  }
};

/**
 * D4 — Doctor completes an appointment with notes/diagnosis (goal 13, doctor-owned).
 * Verifies the appointment belongs to this doctor before updating.
 */
export const completeMyAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const doctor = await getDoctorForUser(req.userId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    }
    const { doctorNotes, diagnosis } = req.body;

    const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctor._id });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found or not yours' });
    }

    appointment.status = 'COMPLETED';
    // Store diagnosis + notes together in doctorNotes (schema has doctorNotes field)
    appointment.doctorNotes = diagnosis
      ? `Diagnosis: ${diagnosis}\nNotes: ${doctorNotes || ''}`.trim()
      : doctorNotes;
    await appointment.save();

    res.status(200).json({ success: true, message: 'Appointment completed', data: appointment });
  } catch (error: any) {
    console.error('Complete appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete appointment', error: error.message });
  }
};
