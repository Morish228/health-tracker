import mongoose, { Schema, Document } from 'mongoose';

/**
 * A notification delivered to a user (in-app always; email/SMS best-effort).
 * `channelsSent` records which channels actually went out.
 */
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'APPOINTMENT' | 'SOS' | 'THRESHOLD' | 'MISSED_DOSE' | 'CAREGIVER_INVITE' | 'GENERAL';
  title: string;
  body: string;
  channelsSent: string[]; // e.g. ['in_app','email','sms']
  read: boolean;
  meta: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['APPOINTMENT', 'SOS', 'THRESHOLD', 'MISSED_DOSE', 'CAREGIVER_INVITE', 'GENERAL'],
      default: 'GENERAL',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    channelsSent: {
      type: [String],
      default: ['in_app'],
    },
    read: {
      type: Boolean,
      default: false,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
