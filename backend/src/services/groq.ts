/**
 * Tiny Groq helper for the Node backend using Groq's OpenAI-compatible REST API +
 * native fetch (Node 18+). No extra npm dependency. Degrades gracefully when
 * GROQ_API_KEY is missing.
 */
// Read env lazily (at call time), not at module load — otherwise the values are
// captured before index.ts runs dotenv.config(), leaving the key undefined.
const getApiKey = (): string | undefined => process.env.GROQ_API_KEY;
const getModel = (): string => process.env.STRONG_MODEL || 'llama-3.3-70b-versatile';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const isGroqConfigured = (): boolean => Boolean(getApiKey());

/**
 * Send a prompt to Groq and get the plain-text response.
 * Returns null if not configured or on any error (callers should handle null).
 */
export const groqGenerate = async (
  prompt: string,
  opts: { json?: boolean } = {},
): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!resp.ok) {
      console.error('Groq API error:', resp.status, await resp.text());
      return null;
    }
    const data: any = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text.trim() : null;
  } catch (err) {
    console.error('Groq request failed:', err);
    return null;
  }
};

/**
 * Ask Groq for JSON and parse it. Uses JSON mode; strips markdown fences defensively.
 * Returns null on failure so callers can fall back safely.
 */
export const groqGenerateJSON = async <T = any>(prompt: string): Promise<T | null> => {
  const raw = await groqGenerate(prompt, { json: true });
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('Failed to parse Groq JSON:', raw);
    return null;
  }
};
