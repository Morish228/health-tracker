import { Request, Response } from 'express';
import { Doctor } from '../models/Doctor';
import { AvailabilitySlot } from '../models/AvailabilitySlot';
import { Hospital } from '../models/Hospital';

// List all doctors (with optional specialization filter) and populate hospital details
export const getDoctors = async (req: Request, res: Response) => {
  try {
    const { specialization } = req.query;
    const filter: any = {};

    if (specialization) {
      filter.specialization = { $regex: new RegExp(specialization as string, 'i') };
    }

    //filter = {
    //     specialization: {
    //         $regex: /cardio/i
    //     }
    // }  i am telling mongodb -> find all docs whose specialisation matches the regex(cardio) and i stands for case insensitive
    // cardiologist.includes(cardio)?

    const doctors = await Doctor.find(filter).populate('hospitalId', 'name address contactInfo');

    res.status(200).json({
      success: true,
      data: doctors,
    });
  } catch (error: any) {
    console.error('Get doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve doctors',
      error: error.message,
    });
  }
};

// Get a specific doctor by ID with hospital details
export const getDoctorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const doctor = await Doctor.findById(id).populate('hospitalId', 'name address contactInfo');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (error: any) {
    console.error('Get doctor by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve doctor',
      error: error.message,
    });
  }
};

// Get available slots for a doctor on a specific date
export const getDoctorSlots = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // doctorId
    const { date } = req.query; // YYYY-MM-DD string

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "date" (YYYY-MM-DD) is required',
      });
    }

    // Set range for the given day from start (00:00:00) to end (23:59:59)
    const searchDate = new Date(date as string);
    const startOfDay = new Date(searchDate.setUTCHours(0, 0, 0, 0));
    const endOfDay = new Date(searchDate.setUTCHours(23, 59, 59, 999));

    const slots = await AvailabilitySlot.find({
      doctorId: id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'AVAILABLE',
    }).sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (error: any) {
    console.error('Get doctor slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve availability slots',
      error: error.message,
    });
  }
};
