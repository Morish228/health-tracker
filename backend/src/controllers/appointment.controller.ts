import { Response } from 'express';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment';
import { AvailabilitySlot } from '../models/AvailabilitySlot';
import { Doctor } from '../models/Doctor';
import { AuthRequest } from '../middlewares/auth';
import { notifyUser } from '../services/notification';

// Book a new appointment (using a Mongoose transaction to prevent double booking)
export const bookAppointment = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { slotId, symptoms } = req.body;
    const patientId = req.userId;

    if (!slotId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'slotId is required',
      });
    }

    // 1. Fetch the slot and lock it for update (by checking status)
    const slot = await AvailabilitySlot.findById(slotId).session(session);

    if (!slot) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Availability slot not found',
      });
    }

    if (slot.status !== 'AVAILABLE') {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'This slot is already taken or blocked',
      });
    }

    // 2. Mark the slot as TAKEN
    slot.status = 'TAKEN';
    await slot.save({ session });

    // 3. Construct the appointment date/time
    // Combine slot date (YYYY-MM-DD) and startTime (HH:MM)
    const slotDate = new Date(slot.date);
    const [hours, minutes] = slot.startTime.split(':').map(Number);
    slotDate.setHours(hours, minutes, 0, 0);

    // 4. Create the appointment
    const appointment = await Appointment.create(
      [
        {
          patientId,
          doctorId: slot.doctorId,
          slotId: slot._id,
          dateTime: slotDate,
          status: 'SCHEDULED',
          symptoms,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Goal 40 — confirmation notification (in-app + email best-effort).
    try {
      await notifyUser(patientId!, {
        type: 'APPOINTMENT',
        title: 'Appointment confirmed',
        body: `Your appointment is booked for ${slotDate.toLocaleString()}.`,
        meta: { appointmentId: appointment[0]._id },
        channels: ['in_app', 'email'],
      });
    } catch (notifyErr) {
      console.error('Booking notification failed:', notifyErr);
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment[0],
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Book appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book appointment',
      error: error.message,
    });
  }
};

// Cancel an appointment and release the slot
export const cancelAppointment = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const patientId = req.userId;

    const appointment = await Appointment.findById(id).session(session);

    if (!appointment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Check ownership (only the patient who booked it can cancel it)
    if (appointment.patientId.toString() !== patientId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this appointment',
      });
    }

    if (appointment.status === 'CANCELLED') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled',
      });
    }

    // 1. Update appointment status
    appointment.status = 'CANCELLED';
    await appointment.save({ session });

    // 2. Release the slot back to AVAILABLE
    await AvailabilitySlot.findByIdAndUpdate(
      appointment.slotId,
      { status: 'AVAILABLE' },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment,
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message,
    });
  }
};

// Complete an appointment and add notes (simulated doctor action or seeded outcome)
export const completeAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { doctorNotes } = req.body;

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status: 'COMPLETED', doctorNotes },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Appointment completed successfully',
      data: appointment,
    });
  } catch (error: any) {
    console.error('Complete appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete appointment',
      error: error.message,
    });
  }
};

// Get all appointments for the logged-in patient
export const getMyAppointments = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.userId;

    const appointments = await Appointment.find({ patientId })
      .populate({
        path: 'doctorId',
        select: 'name specialization qualifications contact hospitalId',
        populate: {
          path: 'hospitalId',
          select: 'name address',
        },
      })
      .populate('slotId', 'date startTime endTime')
      .sort({ dateTime: -1 });

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error: any) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appointments',
      error: error.message,
    });
  }
};

/**
 * T5 — Book a follow-up appointment linked to an original one.
 * Books a new appointment against `slotId` (same double-booking protection as bookAppointment)
 * and sets the original appointment's `followUpId` to point at the new appointment.
 * Body: { originalAppointmentId, slotId, symptoms? }
 */
export const bookFollowUp = async (req: AuthRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { originalAppointmentId, slotId, symptoms } = req.body;
    const patientId = req.userId;

    if (!originalAppointmentId || !slotId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'originalAppointmentId and slotId are required',
      });
    }

    // 1. Verify the original appointment belongs to this patient.
    const original = await Appointment.findById(originalAppointmentId).session(session);
    if (!original || original.patientId.toString() !== patientId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Original appointment not found',
      });
    }

    // 2. Lock and validate the new slot.
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

    // 3. Create the follow-up appointment.
    const [followUp] = await Appointment.create(
      [
        {
          patientId,
          doctorId: slot.doctorId,
          slotId: slot._id,
          dateTime: slotDate,
          status: 'SCHEDULED',
          symptoms,
        },
      ],
      { session }
    );

    // 4. Link the original -> follow-up.
    original.followUpId = followUp._id as mongoose.Types.ObjectId;
    await original.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Follow-up appointment booked and linked',
      data: { followUp, originalAppointmentId },
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('Book follow-up error:', error);
    res.status(500).json({ success: false, message: 'Failed to book follow-up', error: error.message });
  }
};
