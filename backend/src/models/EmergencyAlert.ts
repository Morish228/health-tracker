import mongoose, { Schema, Document } from 'mongoose';

/**
 * Records an emergency / anomaly event for a patient. Created by the agent (SOS on
 * emergency triage), by a manual SOS press, or by the system (vital breach).
 */
export interface IEmergencyAlert extends Document {
  patientId: mongoose.Types.ObjectId;
  type: 'SOS' | 'VITAL_BREACH' | 'MISSED_DOSE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  source: 'AGENT' | 'MANUAL' | 'SYSTEM';
  notifiedUserIds: mongoose.Types.ObjectId[];
  triggeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emergencyAlertSchema = new Schema<IEmergencyAlert>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['SOS', 'VITAL_BREACH', 'MISSED_DOSE'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH',
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'],
      default: 'ACTIVE',
    },
    source: {
      type: String,
      enum: ['AGENT', 'MANUAL', 'SYSTEM'],
      default: 'MANUAL',
    },
    notifiedUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

emergencyAlertSchema.index({ patientId: 1, status: 1, triggeredAt: -1 });

export const EmergencyAlert = mongoose.model<IEmergencyAlert>('EmergencyAlert', emergencyAlertSchema);
