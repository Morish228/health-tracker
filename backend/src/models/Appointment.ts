import mongoose, { Schema, Document } from 'mongoose';

export interface IAppointment extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  slotId: mongoose.Types.ObjectId;
  dateTime: Date;
  status: 'SCHEDULED' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
  symptoms?: string;
  doctorNotes?: string;
  followUpId?: mongoose.Types.ObjectId;
  prescriptionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    slotId: {
      type: Schema.Types.ObjectId,
      ref: 'AvailabilitySlot',
      required: true,
    },
    dateTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    symptoms: {
      type: String,
      trim: true,
    },
    doctorNotes: {
      type: String,
      trim: true,
    },
    followUpId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Prescription',
    },
  },
  {
    timestamps: true,
  }
);

export const Appointment = mongoose.model<IAppointment>('Appointment', appointmentSchema);
