import { Response } from 'express';
import { VitalLog, VitalType } from '../models/VitalLog';
import { VitalThreshold } from '../models/VitalThreshold';
import { EmergencyAlert } from '../models/EmergencyAlert';
import { AuthRequest } from '../middlewares/auth';
import { notifyUser } from '../services/notification';
import { notifyCaregivers } from '../services/careAlerts';

// Helper: Check if the last 3 readings for a vital type exceed thresholds
const checkVitalsAlert = async (patientId: string, vitalType: VitalType): Promise<{ triggered: boolean; message?: string }> => {
  try {
    // 1. Get threshold settings for this vital type
    const threshold = await VitalThreshold.findOne({ patientId, vitalType });
    if (!threshold) return { triggered: false };

    // 2. Fetch the 3 most recent vital log entries
    const logs = await VitalLog.find({ patientId, type: vitalType })
      .sort({ recordedAt: -1 })
      .limit(3);
    // If we don't have at least 3 logs, we can't assert a consecutive breach trend
    if (logs.length < 3) return { triggered: false };

    // 3. Evaluate if all 3 readings consecutively breached the boundaries
    const isBreaching = logs.every(log => log.value < threshold.minSafe || log.value > threshold.maxSafe);

    if (isBreaching) {
      return {
        triggered: true,
        message: `Alert: 3 consecutive readings for ${vitalType} have breached your safe range (${threshold.minSafe} - ${threshold.maxSafe}). Last readings: ${logs.map(l => l.value).join(', ')}.`,
      };
    }

    return { triggered: false };
  } catch (error) {
    console.error('Check vitals alert error:', error);
    return { triggered: false };
  }
};

// Log a vital reading
export const logVital = async (req: AuthRequest, res: Response) => {
  try {
    const { type, value, unit, recordedAt, note } = req.body;
    const patientId = req.userId;

    if (!type || value === undefined || !unit) {
      return res.status(400).json({
        success: false,
        message: 'type, value, and unit are required',
      });
    }

    const log = await VitalLog.create({
      patientId,
      type,
      value,
      unit,
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      note,
    });

    // Run threshold alerts check
    const alertResult = await checkVitalsAlert(patientId!, type);

    // On a confirmed breach: record it, notify the patient, and alert caregivers (goal 31).
    // Fires "on write" (accepted limitation #1: no real-time/WebSockets).
    if (alertResult.triggered) {
      try {
        await EmergencyAlert.create({
          patientId,
          type: 'VITAL_BREACH',
          severity: 'HIGH',
          message: alertResult.message!,
          source: 'SYSTEM',
        });
        await notifyUser(patientId!, {
          type: 'THRESHOLD',
          title: 'Vital threshold breached',
          body: alertResult.message!,
          meta: { vitalType: type },
        });
        await notifyCaregivers(patientId!, 'THRESHOLD', 'Patient vital breach', alertResult.message!, {
          vitalType: type,
        });
      } catch (notifyErr) {
        console.error('Vital breach notification failed:', notifyErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Vital reading logged successfully',
      data: log,
      alert: alertResult.triggered ? { triggered: true, message: alertResult.message } : { triggered: false },
    });
  } catch (error: any) {
    console.error('Log vital error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log vital reading',
      error: error.message,
    });
  }
};

// Retrieve history for a specific vital type with date range filters
export const getVitalHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query;
    const { from, to } = req.query;
    const patientId = req.userId;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "type" (VitalType) is required',
      });
    }

    const filter: any = {
      patientId,
      type: type as string,
    };

    if (from || to) {
      filter.recordedAt = {};
      if (from) filter.recordedAt.$gte = new Date(from as string);
      if (to) filter.recordedAt.$lte = new Date(to as string);
    }

    const logs = await VitalLog.find(filter).sort({ recordedAt: 1 });

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('Get vital history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vital history',
      error: error.message,
    });
  }
};

// Retrieve the single latest log for each vital type
export const getLatestPerType = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.userId;

    const latestVitals = await VitalLog.aggregate([
      { $match: { patientId: new mongoose.Types.ObjectId(patientId) } },
      { $sort: { recordedAt: -1 } },
      {
        $group: {
          _id: '$type',
          latestDoc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$latestDoc' } },
    ]);

    res.status(200).json({
      success: true,
      data: latestVitals,
    });
  } catch (error: any) {
    console.error('Get latest vitals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve latest vitals',
      error: error.message,
    });
  }
};

// Upsert vitals safety thresholds
export const upsertThresholds = async (req: AuthRequest, res: Response) => {
  try {
    const { vitalType, minSafe, maxSafe } = req.body;
    const patientId = req.userId;

    if (!vitalType || minSafe === undefined || maxSafe === undefined) {
      return res.status(400).json({
        success: false,
        message: 'vitalType, minSafe, and maxSafe are required',
      });
    }

    const threshold = await VitalThreshold.findOneAndUpdate(
      { patientId, vitalType },
      { minSafe, maxSafe },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Vitals safety thresholds updated successfully',
      data: threshold,
    });
  } catch (error: any) {
    console.error('Upsert thresholds error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vitals thresholds',
      error: error.message,
    });
  }
};

// Get configured thresholds for all vital types
export const getThresholds = async (req: AuthRequest, res: Response) => {
  try {
    const patientId = req.userId;
    const thresholds = await VitalThreshold.find({ patientId });

    res.status(200).json({
      success: true,
      data: thresholds,
    });
  } catch (error: any) {
    console.error('Get thresholds error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vitals thresholds',
      error: error.message,
    });
  }
};
import mongoose from 'mongoose';
