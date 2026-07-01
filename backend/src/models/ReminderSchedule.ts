import mongoose, { Schema, Document } from 'mongoose';

export interface IReminderSchedule extends Document {
  patientId: mongoose.Types.ObjectId;
  prescriptionId: mongoose.Types.ObjectId;
  medicationName: string;
  times: string[]; // e.g. ["08:00", "20:00"]
  timezone: string; // e.g. "UTC", "Asia/Kolkata"
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reminderScheduleSchema = new Schema<IReminderSchedule>(
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
    times: {
      type: [String],
      required: true,
      validate: {
        validator: function(v: string[]) {
          // Verify format is HH:MM for all times
          return v.every(time => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time));
        },
        message: 'All reminder times must be in HH:MM format',
      },
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly find active schedules for a patient
reminderScheduleSchema.index({ patientId: 1, active: 1 });

export const ReminderSchedule = mongoose.model<IReminderSchedule>(
  'ReminderSchedule',
  reminderScheduleSchema
);
