import mongoose, { Schema, Document } from 'mongoose';
import { VitalType } from './VitalLog';

export interface IVitalThreshold extends Document {
  patientId: mongoose.Types.ObjectId;
  vitalType: VitalType;
  minSafe: number; // e.g. 90 for Systolic BP, 70 for heart rate
  maxSafe: number; // e.g. 140 for Systolic BP, 100 for heart rate
  createdAt: Date;
  updatedAt: Date;
}

const vitalThresholdSchema = new Schema<IVitalThreshold>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vitalType: {
      type: String,
      enum: Object.values(VitalType),
      required: true,
    },
    minSafe: {
      type: Number,
      required: true,
    },
    maxSafe: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index to ensure only one threshold definition per vital type per patient
vitalThresholdSchema.index({ patientId: 1, vitalType: 1 }, { unique: true });

export const VitalThreshold = mongoose.model<IVitalThreshold>(
  'VitalThreshold',
  vitalThresholdSchema
);
