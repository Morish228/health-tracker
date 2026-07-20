import { Response } from 'express';
import { ReminderSchedule } from '../models/ReminderSchedule';
import { Prescription } from '../models/Prescription';
import { AuthRequest } from '../middlewares/auth';

/**
 * T3 — Medication reminder schedules.
 * The "due today" checklist is computed by GET /api/adherence/today from these schedules;
 * this controller manages the schedules themselves (create/list/update/delete).
 */

/** Create a reminder schedule for a medication. Body: { prescriptionId, medicationName, times[], timezone? } */
export const createReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { prescriptionId, medicationName, times, timezone } = req.body;
    const patientId = req.userId;

    if (!prescriptionId || !medicationName || !Array.isArray(times) || times.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'prescriptionId, medicationName, and a non-empty times[] are required',
      });
    }

    // Verify the prescription belongs to this patient.
    const prescription = await Prescription.findOne({ _id: prescriptionId, patientId });
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    const reminder = await ReminderSchedule.create({
      patientId,
      prescriptionId,
      medicationName,
      times,
      timezone: timezone || 'UTC',
      active: true,
    });

    res.status(201).json({ success: true, message: 'Reminder created', data: reminder });
  } catch (error: any) {
    console.error('Create reminder error:', error);
    res.status(500).json({ success: false, message: 'Failed to create reminder', error: error.message });
  }
};

/**
 * Convenience: create reminders for EVERY medication in a prescription at once.
 * Body: { prescriptionId, times[] } applies the same times to each medication.
 */
export const createRemindersForPrescription = async (req: AuthRequest, res: Response) => {
  try {
    const { prescriptionId, times, timezone } = req.body;
    const patientId = req.userId;

    if (!prescriptionId || !Array.isArray(times) || times.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'prescriptionId and a non-empty times[] are required',
      });
    }

    const prescription = await Prescription.findOne({ _id: prescriptionId, patientId });
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }

    const docs = prescription.medications.map((m) => ({
      patientId,
      prescriptionId,
      medicationName: m.medicationName,
      times,
      timezone: timezone || 'UTC',
      active: true,
    }));

    const created = await ReminderSchedule.insertMany(docs, { ordered: false }).catch((e: any) => {
      if (e?.insertedDocs) return e.insertedDocs;
      throw e;
    });

    res.status(201).json({ success: true, message: 'Reminders created', data: created });
  } catch (error: any) {
    console.error('Create reminders for prescription error:', error);
    res.status(500).json({ success: false, message: 'Failed to create reminders', error: error.message });
  }
};

/** List the patient's reminder schedules. */
export const getMyReminders = async (req: AuthRequest, res: Response) => {
  try {
    const reminders = await ReminderSchedule.find({ patientId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: reminders });
  } catch (error: any) {
    console.error('Get reminders error:', error);
    res.status(500).json({ success: false, message: 'Failed to load reminders', error: error.message });
  }
};

/** Update a reminder (times, timezone, or active on/off). */
export const updateReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { times, timezone, active } = req.body;
    const reminder = await ReminderSchedule.findOneAndUpdate(
      { _id: req.params.id, patientId: req.userId },
      { times, timezone, active },
      { new: true, omitUndefined: true }
    );
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }
    res.status(200).json({ success: true, message: 'Reminder updated', data: reminder });
  } catch (error: any) {
    console.error('Update reminder error:', error);
    res.status(500).json({ success: false, message: 'Failed to update reminder', error: error.message });
  }
};

/** Delete a reminder schedule. */
export const deleteReminder = async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await ReminderSchedule.findOneAndDelete({ _id: req.params.id, patientId: req.userId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }
    res.status(200).json({ success: true, message: 'Reminder deleted' });
  } catch (error: any) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete reminder', error: error.message });
  }
};
