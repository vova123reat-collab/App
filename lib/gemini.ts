import "server-only";
import { GoogleGenAI, Schema } from "@google/genai";

export const DEFAULT_MODEL = "gemini-3.8-flash";

/** Генерує JSON за схемою; якщо модель з env знято — пробує модель за замовчуванням. */
export async function generateJson<T>(prompt: string, schema: Schema, temperature = 0.4): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY не задано"), { status: 503 });

  const ai = new GoogleGenAI({ apiKey });
  const call = (model: string) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema, temperature },
    });

  const wanted = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  let res;
  try {
    res = await call(wanted);
  } catch (e) {
    if ((e as { status?: number }).status !== 404 || wanted === DEFAULT_MODEL) throw e;
    console.warn(`[gemini] model ${wanted} unavailable, falling back to ${DEFAULT_MODEL}`);
    res = await call(DEFAULT_MODEL);
  }
  return JSON.parse(res.text ?? "{}") as T;
}
