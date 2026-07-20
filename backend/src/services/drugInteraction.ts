/**
 * Drug-interaction check (goal 8).
 *
 * PROTOTYPE LIMITATION: this uses an LLM (Groq/Llama), NOT a clinical database like
 * RxNorm/DrugBank. It is NOT clinically reliable and every result carries a disclaimer.
 * Results are cached by medicine-set so we never pay for the same check twice.
 */
import { DrugInteractionCache } from '../models/DrugInteractionCache';
import { groqGenerateJSON, isGroqConfigured } from './groq';

const DISCLAIMER =
  'AI-generated, not a clinical source. Not a substitute for a pharmacist or doctor.';

export interface InteractionResult {
  checked: boolean; // false when we couldn't run the check (no API key)
  hasInteraction: boolean;
  severity: 'none' | 'minor' | 'moderate' | 'severe' | 'unknown';
  summary: string;
  details: string;
  disclaimer: string;
}

/** Normalize a medicine list into a stable cache key. */
const buildKey = (meds: string[]): string =>
  meds
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');

export const checkDrugInteractions = async (medications: string[]): Promise<InteractionResult> => {
  const meds = [...new Set(medications.map((m) => m.trim()).filter(Boolean))];

  // Fewer than 2 medicines => nothing to interact.
  if (meds.length < 2) {
    return {
      checked: true,
      hasInteraction: false,
      severity: 'none',
      summary: 'Only one medication — no interactions to check.',
      details: '',
      disclaimer: DISCLAIMER,
    };
  }

  const key = buildKey(meds);

  // 1. Cache hit?
  const cached = await DrugInteractionCache.findOne({ key });
  if (cached) {
    return {
      checked: true,
      hasInteraction: cached.hasInteraction,
      severity: cached.severity,
      summary: cached.summary,
      details: cached.details,
      disclaimer: DISCLAIMER,
    };
  }

  // 2. No API key => can't check; say so honestly instead of guessing.
  if (!isGroqConfigured()) {
    return {
      checked: false,
      hasInteraction: false,
      severity: 'unknown',
      summary: 'Drug-interaction check unavailable (AI not configured).',
      details: '',
      disclaimer: DISCLAIMER,
    };
  }

  // 3. Ask the LLM for a structured verdict.
  const prompt =
    `You are a clinical pharmacology assistant. Assess potential drug-drug interactions ` +
    `between these medications: ${meds.join(', ')}.\n` +
    `Respond ONLY with JSON of the exact shape:\n` +
    `{"hasInteraction": boolean, "severity": "none"|"minor"|"moderate"|"severe", ` +
    `"summary": "one sentence", "details": "short explanation of the key interactions"}`;

  const parsed = await groqGenerateJSON<{
    hasInteraction: boolean;
    severity: 'none' | 'minor' | 'moderate' | 'severe';
    summary: string;
    details: string;
  }>(prompt);

  if (!parsed) {
    return {
      checked: false,
      hasInteraction: false,
      severity: 'unknown',
      summary: 'Could not complete the interaction check.',
      details: '',
      disclaimer: DISCLAIMER,
    };
  }

  const result: InteractionResult = {
    checked: true,
    hasInteraction: Boolean(parsed.hasInteraction),
    severity: parsed.severity || 'unknown',
    summary: parsed.summary || '',
    details: parsed.details || '',
    disclaimer: DISCLAIMER,
  };

  // 4. Cache it (best-effort; ignore duplicate-key races).
  await DrugInteractionCache.create({
    key,
    medications: meds,
    hasInteraction: result.hasInteraction,
    severity: result.severity,
    summary: result.summary,
    details: result.details,
  }).catch(() => undefined);

  return result;
};
