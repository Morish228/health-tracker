import mongoose, { Schema, Document } from 'mongoose';

export interface IHospital extends Document {
  name: string;
  address: string;
  contactInfo?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const hospitalSchema = new Schema<IHospital>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    contactInfo: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const Hospital = mongoose.model<IHospital>('Hospital', hospitalSchema);
