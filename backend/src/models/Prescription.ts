import mongoose, { Schema, Document } from 'mongoose';

export interface IMedication {
  medicationName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface IPrescription extends Document {
  patientId: mongoose.Types.ObjectId;
  sourceAppointmentId?: mongoose.Types.ObjectId;
  doctorName?: string;
  medications: IMedication[];
  notes?: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const medicationSchema = new Schema<IMedication>({
  medicationName: {
    type: String,
    required: true,
    trim: true,
  },
  dosage: {
    type: String,
    trim: true,
  },
  frequency: {
    type: String,
    trim: true, // e.g. "Once daily", "Twice daily", "08:00, 20:00"
  },
  duration: {
    type: String,
    trim: true, // e.g. "7 days", "1 month"
  },
  instructions: {
    type: String,
    trim: true, // e.g. "Take after food"
  },
});

const prescriptionSchema = new Schema<IPrescription>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sourceAppointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    doctorName: {
      type: String,
      trim: true,
    },
    medications: [medicationSchema],
    notes: {
      type: String,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const Prescription = mongoose.model<IPrescription>('Prescription', prescriptionSchema);
