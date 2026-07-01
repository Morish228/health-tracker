import mongoose, { Schema, Document } from 'mongoose';

export interface IAvailabilitySlot extends Document {
  doctorId: mongoose.Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'AVAILABLE' | 'TAKEN' | 'BLOCKED';
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySlotSchema = new Schema<IAvailabilitySlot>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'TAKEN', 'BLOCKED'],
      default: 'AVAILABLE',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate slots for the same doctor at the same date and time
availabilitySlotSchema.index({ doctorId: 1, date: 1, startTime: 1 }, { unique: true });

export const AvailabilitySlot = mongoose.model<IAvailabilitySlot>(
  'AvailabilitySlot',
  availabilitySlotSchema
);
