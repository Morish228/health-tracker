import { Response } from 'express';
import { AdherenceLog } from '../models/AdherenceLog';
import { ReminderSchedule } from '../models/ReminderSchedule';
import { AuthRequest } from '../middlewares/auth';

// Helper to strip time from a Date object (keeps YYYY-MM-DD 00:00:00 UTC)
const getUTCDateWithoutTime = (dateInput?: string | Date) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

// Log a specific dose (Taken / Not Taken)
export const logDose = async (req: AuthRequest, res: Response) => {
  try {
    const { prescriptionId, medicationName, scheduledTime, date, taken, note } = req.body;
    const patientId = req.userId;

    if (!prescriptionId || !medicationName || !scheduledTime || !date) {
      return res.status(400).json({
        success: false,
        message: 'prescriptionId, medicationName, scheduledTime, and date are required',
      });
    }

    const logDate = getUTCDateWithoutTime(date);

    // Upsert the log for this specific schedule combo
    const adherenceLog = await AdherenceLog.findOneAndUpdate(
      {
        patientId,
        prescriptionId,
        medicationName,
        date: logDate,
        scheduledTime,
      },
      {
        taken,
        takenAt: taken ? new Date() : undefined,
        note,
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Medication dose logged successfully',
      data: adherenceLog,
    });
  } catch (error: any) {
    console.error('Log dose error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log medication dose',
      error: error.message,
    });
  }
};

// Get today's medication completion checklist
export const getTodayStatus = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.userId;
    const today = getUTCDateWithoutTime();

    // 1. Get all active reminder schedules for the patient
    const schedules = await ReminderSchedule.find({ patientId, active: true });

    // 2. Get today's logged doses
    const logs = await AdherenceLog.find({
      patientId,
      date: today,
    });

    // 3. Match schedules to today's logged actions
    const checklist = [];
    for (const schedule of schedules) {
      for (const time of schedule.times) {
        const matchedLog = logs.find(
          log =>
            log.prescriptionId.toString() === schedule.prescriptionId.toString() &&
            log.medicationName === schedule.medicationName &&
            log.scheduledTime === time
        );

        checklist.push({
          prescriptionId: schedule.prescriptionId,
          medicationName: schedule.medicationName,
          scheduledTime: time,
          date: today,
          taken: matchedLog ? matchedLog.taken : false,
          takenAt: matchedLog ? matchedLog.takenAt : null,
          note: matchedLog ? matchedLog.note : '',
          logId: matchedLog ? matchedLog._id : null,
        });
      }
    }

    // Sort by scheduled time
    checklist.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    res.status(200).json({
      success: true,
      date: today,
      data: checklist,
    });
  } catch (error: any) {
    console.error('Get today status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve today\'s status',
      error: error.message,
    });
  }
};

// Get the consecutive days adherence streak
export const getStreakCount = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.userId;
    let streak = 0;
    let checkDate = getUTCDateWithoutTime(); // Start with today

    // Get active reminder schedules to understand daily requirement
    const schedules = await ReminderSchedule.find({ patientId, active: true });
    if (schedules.length === 0) {
      return res.status(200).json({ success: true, streak: 0 });
    }

    // Calculate total doses required in a single day
    let dailyRequiredCount = 0;
    schedules.forEach(s => {
      dailyRequiredCount += s.times.length;
    });

    while (true) {
      // Find logs for checkDate that were marked as taken
      const takenLogsCount = await AdherenceLog.countDocuments({
        patientId,
        date: checkDate,
        taken: true,
      });

      // If the patient completed all required doses for this day
      if (takenLogsCount >= dailyRequiredCount) {
        streak++;
        // Go to previous day
        checkDate.setUTCDate(checkDate.getUTCDate() - 1);
      } else {
        // Streak is broken (stop counting if not completed, unless it's today and they haven't completed all doses yet)
        const isToday = checkDate.getTime() === getUTCDateWithoutTime().getTime();
        if (isToday) {
          // If today is incomplete, look at yesterday to see if the streak is active up to yesterday
          checkDate.setUTCDate(checkDate.getUTCDate() - 1);
          continue;
        }
        break;
      }
    }

    res.status(200).json({
      success: true,
      streak,
    });
  } catch (error: any) {
    console.error('Get streak count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate streak',
      error: error.message,
    });
  }
};

// Retrieve history of missed doses
export const getMissedDoses = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.userId;

    // Retrieve logs where taken is explicitly false (or where scheduled but not checked)
    const missedLogs = await AdherenceLog.find({
      patientId,
      taken: false,
    }).sort({ date: -1, scheduledTime: -1 });

    res.status(200).json({
      success: true,
      data: missedLogs,
    });
  } catch (error: any) {
    console.error('Get missed doses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve missed doses',
      error: error.message,
    });
  }
};
