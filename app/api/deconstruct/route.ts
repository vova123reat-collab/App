import { Type } from "@google/genai";
import { NextResponse } from "next/server";
import { generateJson } from "@/lib/gemini";

export const runtime = "nodejs";

const STAGES = [
  "Етап 1 (Години 1–3) — База і терміни: що треба зрозуміти в теорії, щоб не плавати.",
  "Етап 2 (Години 4–8) — Ізольована механіка: відпрацювання найпростіших елементів окремо.",
  "Етап 3 (Години 9–15) — Комбінація і практика: з'єднання елементів у реальну дію.",
  "Етап 4 (Години 16–20) — Автоматизм (Фінальний Бос): самостійне виконання завдання без підказок.",
];

const schema = {
  type: Type.OBJECT,
  properties: {
    attr: {
      type: Type.STRING,
      enum: ["int", "str", "end", "spi"],
      description: "int — розумова/технічна, str — сила, end — витривалість/рухливість, spi — дух, емоції, творчість, комунікація",
    },
    stages: {
      type: Type.ARRAY,
      minItems: "4",
      maxItems: "4",
      items: {
        type: Type.OBJECT,
        properties: {
          steps: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: "3", maxItems: "6" },
        },
        required: ["steps"],
      },
    },
  },
  required: ["attr", "stages"],
};

export async function POST(req: Request) {
  const { skill, context } = (await req.json().catch(() => ({}))) as { skill?: string; context?: string };
  const name = (skill ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Вкажи назву навички" }, { status: 400 });

  const prompt = `Ти — тренер за методом Джоша Кауфмана «Перші 20 годин».
Деконструюй навичку «${name}» на конкретні мікро-кроки для 4 етапів:
${STAGES.join("\n")}
${context ? `Контекст користувача: ${context.slice(0, 400)}\n` : ""}
Вимоги до кроків: українською, кожен крок — одна конкретна дія, яку можна виконати за 20–60 хвилин,
з вимірюваним результатом (наприклад «Зробити 3 підходи по 5 негативних підтягувань», а не «Тренуй силу»).
Без води та загальних порад.`;

  try {
    const data = await generateJson<{ attr: string; stages: { steps: string[] }[] }>(prompt, schema, 0.6);
    if (!Array.isArray(data.stages) || data.stages.length !== 4) throw new Error("bad shape");
    return NextResponse.json(data);
  } catch (e) {
    console.error("[deconstruct]", e);
    const status = (e as { status?: number }).status === 503 ? 503 : 502;
    return NextResponse.json({ error: status === 503 ? "ШІ не налаштовано" : "ШІ не відповів. Спробуй ще раз." }, { status });
  }
}
