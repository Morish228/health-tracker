/**
 * Notification service — one place to create in-app notifications and (best-effort)
 * push them out over email/SMS.
 *
 * PROTOTYPE: real email/SMS providers (nodemailer/Twilio) are NOT wired up — those are
 * added later with real credentials. For now the email/SMS functions log what WOULD be
 * sent so the flow is complete and testable without external accounts. If you later set
 * SMTP_* / TWILIO_* env vars, drop the real client into `sendEmail`/`sendSms`.
 */
import { Notification } from '../models/Notification';
import { Profile } from '../models/Profile';
import { User } from '../models/User';

type NotifChannel = 'in_app' | 'email' | 'sms';

interface NotifyPayload {
  type: 'APPOINTMENT' | 'SOS' | 'THRESHOLD' | 'MISSED_DOSE' | 'CAREGIVER_INVITE' | 'GENERAL';
  title: string;
  body: string;
  meta?: Record<string, any>;
  channels?: NotifChannel[]; // defaults to ['in_app']
}

const emailConfigured = (): boolean => Boolean(process.env.SMTP_URL || process.env.SMTP_HOST);
const smsConfigured = (): boolean => Boolean(process.env.TWILIO_ACCOUNT_SID);

/** Best-effort email. Replace the body with a real client when SMTP is configured. */
const sendEmail = async (to: string | undefined, subject: string, body: string): Promise<boolean> => {
  if (!to) return false;
  if (!emailConfigured()) {
    console.log(`[notify:email] (stub) would email ${to} — "${subject}"`);
    return false; // not actually sent
  }
  // TODO: integrate nodemailer here using SMTP_URL/SMTP_HOST.
  console.log(`[notify:email] sent to ${to} — "${subject}"`);
  return true;
};

/** Best-effort SMS. Replace with Twilio when configured. */
const sendSms = async (to: string | undefined, body: string): Promise<boolean> => {
  if (!to) return false;
  if (!smsConfigured()) {
    console.log(`[notify:sms] (stub) would text ${to} — "${body.slice(0, 60)}"`);
    return false;
  }
  // TODO: integrate Twilio here using TWILIO_* env vars.
  console.log(`[notify:sms] sent to ${to}`);
  return true;
};

/**
 * Create a notification for a single user and fan out to requested channels.
 * Always writes the in-app record; email/SMS are attempted if requested + configured.
 */
export const notifyUser = async (userId: string, payload: NotifyPayload) => {
  const channels = payload.channels || ['in_app'];
  const channelsSent: string[] = ['in_app'];

  // Look up contact info for out-of-app channels.
  if (channels.includes('email') || channels.includes('sms')) {
    const user = await User.findById(userId).select('email');
    const profile = await Profile.findOne({ userId }).select('phone');

    if (channels.includes('email') && (await sendEmail(user?.email, payload.title, payload.body))) {
      channelsSent.push('email');
    }
    if (channels.includes('sms') && (await sendSms(profile?.phone, payload.body))) {
      channelsSent.push('sms');
    }
  }

  return Notification.create({
    userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    meta: payload.meta || {},
    channelsSent,
  });
};

/** Notify many users with the same payload. Returns the created notifications. */
export const notifyUsers = async (userIds: string[], payload: NotifyPayload) => {
  const unique = [...new Set(userIds.filter(Boolean))];
  return Promise.all(unique.map((id) => notifyUser(id, payload)));
};

/**
 * Best-effort SOS to a raw external contact (name/phone) stored on the patient profile,
 * who may not be an app user. Logs since we have no real SMS provider yet.
 */
export const notifyEmergencyContact = async (name?: string, phone?: string, body?: string) => {
  if (!phone) return false;
  return sendSms(phone, `${name ? name + ', ' : ''}${body || 'Emergency alert'}`);
};
