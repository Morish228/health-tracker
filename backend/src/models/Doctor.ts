import mongoose, { Schema, Document } from 'mongoose';

export interface IDoctor extends Document {
  userId?: mongoose.Types.ObjectId; // links to the User login account (absent for legacy seed-only entries)
  name: string;
  specialization: string;
  qualifications?: string;
  hospitalId?: mongoose.Types.ObjectId;
  contact?: string;
  createdAt: Date;
  updatedAt: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      sparse: true, // allow many seed-only doctors with no userId while keeping linked ones unique
    },
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
