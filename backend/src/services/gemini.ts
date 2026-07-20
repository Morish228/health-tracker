/**
 * Tiny Gemini helper for the Node backend using the REST API + native fetch (Node 18+).
 * No extra npm dependency. Degrades gracefully when GEMINI_API_KEY is missing.
 */
// Read env lazily (at call time), not at module load — otherwise the values are
// captured before index.ts runs dotenv.config(), leaving the key undefined.
const getApiKey = (): string | undefined => process.env.GEMINI_API_KEY;
const getModel = (): string => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export const isGeminiConfigured = (): boolean => Boolean(getApiKey());

/**
 * Send a prompt to Gemini and get the plain-text response.
 * Returns null if not configured or on any error (callers should handle null).
 */
export const geminiGenerate = async (prompt: string): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${apiKey}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!resp.ok) {
      console.error('Gemini API error:', resp.status, await resp.text());
      return null;
    }
    const data: any = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? text.trim() : null;
  } catch (err) {
    console.error('Gemini request failed:', err);
    return null;
  }
};

/**
 * Ask Gemini for JSON and parse it. Strips markdown code fences if present.
 * Returns null on failure so callers can fall back safely.
 */
export const geminiGenerateJSON = async <T = any>(prompt: string): Promise<T | null> => {
  const raw = await geminiGenerate(prompt);
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('Failed to parse Gemini JSON:', raw);
    return null;
  }
};
