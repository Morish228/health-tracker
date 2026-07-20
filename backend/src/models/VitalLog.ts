import mongoose, { Schema, Document } from 'mongoose';

export enum VitalType {
  BLOOD_PRESSURE_SYSTOLIC = 'BLOOD_PRESSURE_SYSTOLIC',
  BLOOD_PRESSURE_DIASTOLIC = 'BLOOD_PRESSURE_DIASTOLIC',
  BLOOD_SUGAR = 'BLOOD_SUGAR',
  HEART_RATE = 'HEART_RATE',
  SPO2 = 'SPO2',
  WEIGHT = 'WEIGHT',
  TEMPERATURE = 'TEMPERATURE',
  RESPIRATORY_RATE = 'RESPIRATORY_RATE',
}

export interface IVitalLog extends Document {
  patientId: mongoose.Types.ObjectId;
  type: VitalType;
  value: number;
  unit: string; // e.g. "mmHg", "mg/dL", "bpm", "%", "kg", "C", "bpm"
  recordedAt: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vitalLogSchema = new Schema<IVitalLog>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(VitalType),
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
      required: true,
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

// Index to quickly sort and filter logs by patient, type, and date
vitalLogSchema.index({ patientId: 1, type: 1, recordedAt: -1 });

export const VitalLog = mongoose.model<IVitalLog>('VitalLog', vitalLogSchema);
