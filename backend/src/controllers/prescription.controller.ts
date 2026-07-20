import { Response } from 'express';
import { Prescription } from '../models/Prescription';
import { AuthRequest } from '../middlewares/auth';
import { checkDrugInteractions } from '../services/drugInteraction';

/**
 * T1 — Create a prescription with its medications/dosages.
 * T2 — On create, run a drug-interaction check across all medication names and
 *      return the verdict alongside the saved prescription.
 */
export const createPrescription = async (req: AuthRequest, res: Response) => {
  try {
    const { medications, doctorName, notes, sourceAppointmentId } = req.body;
    const patientId = req.userId;

    if (!Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'medications must be a non-empty array',
      });
    }
    if (medications.some((m: any) => !m.medicationName)) {
      return res.status(400).json({
        success: false,
        message: 'Each medication requires a medicationName',
      });
    }

    const prescription = await Prescription.create({
      patientId,
      medications,
      doctorName,
      notes,
      sourceAppointmentId,
    });

    // Interaction check across the medicines in THIS prescription (goal 8).
    const names = medications.map((m: any) => m.medicationName);
    const interaction = await checkDrugInteractions(names);

    res.status(201).json({
      success: true,
      message: 'Prescription created',
      data: prescription,
      interaction,
    });
  } catch (error: any) {
    console.error('Create prescription error:', error);
    res.status(500).json({ success: false, message: 'Failed to create prescription', error: error.message });
  }
};

/** List all prescriptions for the logged-in patient. */
export const getMyPrescriptions = async (req: AuthRequest, res: Response) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: prescriptions });
  } catch (error: any) {
    console.error('Get prescriptions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load prescriptions', error: error.message });
  }
};

/** Get one prescription (must belong to the patient). */
export const getPrescriptionById = async (req: AuthRequest, res: Response) => {
  try {
    const prescription = await Prescription.findOne({ _id: req.params.id, patientId: req.userId });
    if (!prescription) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    res.status(200).json({ success: true, data: prescription });
  } catch (error: any) {
    console.error('Get prescription error:', error);
    res.status(500).json({ success: false, message: 'Failed to load prescription', error: error.message });
  }
};

/** Delete a prescription the patient owns. */
export const deletePrescription = async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await Prescription.findOneAndDelete({ _id: req.params.id, patientId: req.userId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    res.status(200).json({ success: true, message: 'Prescription deleted' });
  } catch (error: any) {
    console.error('Delete prescription error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete prescription', error: error.message });
  }
};

/**
 * Ad-hoc interaction check without saving a prescription — handy for the agent /
 * "what if I add drug X?" flows.  Body: { medications: string[] }.
 */
export const checkInteractions = async (req: AuthRequest, res: Response) => {
  try {
    const { medications } = req.body;
    if (!Array.isArray(medications)) {
      return res.status(400).json({ success: false, message: 'medications (string[]) is required' });
    }
    const interaction = await checkDrugInteractions(medications);
    res.status(200).json({ success: true, interaction });
  } catch (error: any) {
    console.error('Check interactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to check interactions', error: error.message });
  }
};
