import mongoose, { Schema, Document } from 'mongoose';

export interface IAdherenceLog extends Document {
  patientId: mongoose.Types.ObjectId;
  prescriptionId: mongoose.Types.ObjectId;
  medicationName: string;
  scheduledTime: string; // e.g. "08:00", "20:00"
  date: Date; // Stripped of time (YYYY-MM-DD 00:00:00)
  taken: boolean;
  takenAt?: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adherenceLogSchema = new Schema<IAdherenceLog>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Prescription',
      required: true,
    },
    medicationName: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledTime: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    taken: {
      type: Boolean,
      default: false,
    },
    takenAt: {
      type: Date,
    },
    note: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index to prevent duplicate logging of the same medication dose on the same day and time
adherenceLogSchema.index(
  { patientId: 1, prescriptionId: 1, medicationName: 1, date: 1, scheduledTime: 1 },
  { unique: true }
);

export const AdherenceLog = mongoose.model<IAdherenceLog>('AdherenceLog', adherenceLogSchema);
