import mongoose, { Schema, Document } from 'mongoose';

/**
 * Caches the result of a drug-interaction check so the same set of medicines
 * doesn't call Gemini twice (goal 8 + cost control; mirrors the medicine-scanner cache).
 * `key` is a normalized, sorted, lowercased join of the medicine names.
 */
export interface IDrugInteractionCache extends Document {
  key: string;
  medications: string[];
  hasInteraction: boolean;
  severity: 'none' | 'minor' | 'moderate' | 'severe' | 'unknown';
  summary: string;
  details: string;
  createdAt: Date;
  updatedAt: Date;
}

const drugInteractionCacheSchema = new Schema<IDrugInteractionCache>(
  {
    key: { type: String, required: true, unique: true, index: true },
    medications: { type: [String], required: true },
    hasInteraction: { type: Boolean, default: false },
    severity: {
      type: String,
      enum: ['none', 'minor', 'moderate', 'severe', 'unknown'],
      default: 'unknown',
    },
    summary: { type: String, default: '' },
    details: { type: String, default: '' },
  },
  { timestamps: true }
);

export const DrugInteractionCache = mongoose.model<IDrugInteractionCache>(
  'DrugInteractionCache',
  drugInteractionCacheSchema
);
