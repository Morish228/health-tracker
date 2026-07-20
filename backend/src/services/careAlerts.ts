/**
 * Shared helper: notify all of a patient's ACCEPTED caregivers (goal 31).
 * Used by SOS, vital-breach, and missed-dose flows so caregiver alerting lives in one place.
 */
import { CaregiverPatient } from '../models/CaregiverPatient';
import { notifyUsers } from './notification';

type AlertType = 'SOS' | 'THRESHOLD' | 'MISSED_DOSE';

export const getCaregiverIds = async (patientId: string): Promise<string[]> => {
  const links = await CaregiverPatient.find({
    patientId,
    status: 'ACCEPTED',
    caregiverId: { $ne: null },
  }).select('caregiverId');
  return links.map((l) => l.caregiverId!.toString());
};

export const notifyCaregivers = async (
  patientId: string,
  type: AlertType,
  title: string,
  body: string,
  meta: Record<string, any> = {}
) => {
  const caregiverIds = await getCaregiverIds(patientId);
  if (caregiverIds.length === 0) return [];
  // Escalate over email + SMS for SOS; in-app for the rest.
  const channels = type === 'SOS' ? (['in_app', 'email', 'sms'] as const) : (['in_app'] as const);
  return notifyUsers(caregiverIds, { type, title, body, meta, channels: [...channels] });
};
