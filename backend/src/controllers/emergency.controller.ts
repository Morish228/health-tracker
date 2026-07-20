import { Response } from 'express';
import { EmergencyAlert } from '../models/EmergencyAlert';
import { Profile } from '../models/Profile';
import { AuthRequest } from '../middlewares/auth';
import { notifyEmergencyContact } from '../services/notification';
import { notifyCaregivers, getCaregiverIds } from '../services/careAlerts';

/**
 * Goals 23-24 — trigger an SOS.
 * Creates an EmergencyAlert, notifies all accepted caregivers (email+SMS), and pings the
 * emergency contact stored on the patient's profile. `source` distinguishes a manual press
 * from an agent-detected emergency.
 *
 * Body: { message?, severity?, source?, patientId? }
 *  - patientId is optional; if provided AND it differs from the caller, the caller must be a
 *    linked caregiver (used when a caregiver raises SOS for a patient). Otherwise defaults to self.
 */
export const triggerSOS = async (req: AuthRequest, res: Response) => {
  try {
    const { message, severity, source, patientId: bodyPatientId } = req.body;
    let patientId = req.userId!;

    // Caregiver raising SOS on behalf of a patient.
    if (bodyPatientId && bodyPatientId !== req.userId) {
      const caregiverIds = await getCaregiverIds(bodyPatientId);
      // (caller must be a caregiver of that patient)
      if (!caregiverIds.includes(req.userId!)) {
        return res.status(403).json({ success: false, message: 'Not authorized to SOS for this patient' });
      }
      patientId = bodyPatientId;
    }

    // 1. Record the alert.
    const alert = await EmergencyAlert.create({
      patientId,
      type: 'SOS',
      severity: severity || 'CRITICAL',
      message: message || 'Emergency SOS triggered',
      status: 'ACTIVE',
      source: source === 'AGENT' ? 'AGENT' : 'MANUAL',
      triggeredAt: new Date(),
    });

    // 2. Notify caregivers (in-app + email + sms best-effort).
    const notified = await notifyCaregivers(
      patientId,
      'SOS',
      '🚨 SOS Alert',
      alert.message,
      { alertId: alert._id }
    );

    // 3. Notify the emergency contact on the profile (goal 37 field).
    const profile = await Profile.findOne({ userId: patientId }).select(
      'emergencyContactName emergencyContactPhone firstName'
    );
    if (profile?.emergencyContactPhone) {
      await notifyEmergencyContact(
        profile.emergencyContactName,
        profile.emergencyContactPhone,
        `SOS from ${profile.firstName || 'a patient'}: ${alert.message}`
      );
    }

    // Record who we notified.
    alert.notifiedUserIds = notified.map((n: any) => n.userId);
    await alert.save();

    res.status(201).json({
      success: true,
      message: 'SOS triggered',
      data: alert,
      caregiversNotified: notified.length,
      emergencyContactNotified: Boolean(profile?.emergencyContactPhone),
    });
  } catch (error: any) {
    console.error('Trigger SOS error:', error);
    res.status(500).json({ success: false, message: 'Failed to trigger SOS', error: error.message });
  }
};

/** List the patient's emergency alerts (their own history). */
export const getMyAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const alerts = await EmergencyAlert.find({ patientId: req.userId }).sort({ triggeredAt: -1 });
    res.status(200).json({ success: true, data: alerts });
  } catch (error: any) {
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to load alerts', error: error.message });
  }
};

/** Acknowledge / resolve an alert. Body: { status: 'ACKNOWLEDGED' | 'RESOLVED' } */
export const updateAlertStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['ACKNOWLEDGED', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be ACKNOWLEDGED or RESOLVED' });
    }
    // A patient or one of their caregivers can update.
    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    const caregiverIds = await getCaregiverIds(alert.patientId.toString());
    const canUpdate = alert.patientId.toString() === req.userId || caregiverIds.includes(req.userId!);
    if (!canUpdate) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    alert.status = status;
    await alert.save();
    res.status(200).json({ success: true, message: 'Alert updated', data: alert });
  } catch (error: any) {
    console.error('Update alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to update alert', error: error.message });
  }
};
