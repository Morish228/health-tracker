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
//ok so this line is creating a compound index on 3 fields . and storing them in ascending order . and we are using left prefix rule . if quey is of doctorID , or doctoreid + date . or id+ data+start time . them we can do efficient search and their combination is uniq 

export const AvailabilitySlot = mongoose.model<IAvailabilitySlot>(
  'AvailabilitySlot',
  availabilitySlotSchema
);
