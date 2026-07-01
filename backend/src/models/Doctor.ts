import mongoose, { Schema, Document } from 'mongoose';

export interface IDoctor extends Document {
  name: string;
  specialization: string;
  qualifications?: string;
  hospitalId: mongoose.Types.ObjectId;
  contact?: string;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    qualifications: {
      type: String,
      trim: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      required: true,
    },
    contact: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Doctor = mongoose.model<IDoctor>('Doctor', doctorSchema);
