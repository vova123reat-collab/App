import "server-only";
import { GoogleGenAI, Schema } from "@google/genai";

export const DEFAULT_MODEL = "gemini-3.8-flash";
/** Якщо модель знято (404) або перевантажено (503/429) — пробуємо наступну. */
const FALLBACKS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"];

/** Генерує JSON за схемою з ланцюжком запасних моделей. */
export async function generateJson<T>(prompt: string, schema: Schema, temperature = 0.4): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY не задано"), { status: 503 });

  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 25_000 } });
  const models = Array.from(new Set([process.env.GEMINI_MODEL || DEFAULT_MODEL, ...FALLBACKS]));

  let lastErr: unknown;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema, temperature },
      });
      return JSON.parse(res.text ?? "{}") as T;
    } catch (e) {
      lastErr = e;
      const st = (e as { status?: number }).status;
      const retryable = st === undefined || st === 404 || st === 429 || st === 500 || st === 503 || st === 504;
      if (!retryable) throw e;
      console.warn(`[gemini] ${model} failed (${st ?? "timeout"}), trying next`);
    }
  }
  throw lastErr;
}
