import mongoose, { Schema, Document } from 'mongoose';

/**
 * Links a caregiver (a User) to a patient (a User) with read-only permissions.
 * Flow: patient invites by email -> status PENDING -> caregiver accepts -> ACCEPTED.
 * If the invited email isn't a registered user yet, caregiverId stays null until they
 * register and accept (matched by inviteEmail).
 */
export interface ICaregiverPatient extends Document {
  patientId: mongoose.Types.ObjectId;
  caregiverId?: mongoose.Types.ObjectId;
  inviteEmail: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  permissions: string[]; // subset of ['vitals','adherence','appointments']
  createdAt: Date;
  updatedAt: Date;
}

const caregiverPatientSchema = new Schema<ICaregiverPatient>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    caregiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    inviteEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REVOKED'],
      default: 'PENDING',
    },
    permissions: {
      type: [String],
      default: ['vitals', 'adherence', 'appointments'],
    },
  },
  { timestamps: true }
);

// A given caregiver-email can only be linked to a given patient once.
caregiverPatientSchema.index({ patientId: 1, inviteEmail: 1 }, { unique: true });

export const CaregiverPatient = mongoose.model<ICaregiverPatient>(
  'CaregiverPatient',
  caregiverPatientSchema
);
