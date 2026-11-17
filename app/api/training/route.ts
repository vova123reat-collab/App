import { Type } from "@google/genai";
import { NextResponse } from "next/server";
import { generateJson } from "@/lib/gemini";
import {
  ACTIVITY_LEVELS, EQUIPMENT, GOALS, LEVELS, TrainingAnswers, TrainingPlan,
} from "@/lib/training";

export const runtime = "nodejs";
export const maxDuration = 300;

const exercise = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    sets: { type: Type.INTEGER },
    reps: { type: Type.STRING, description: "діапазон, напр. 6-8" },
    rir: { type: Type.INTEGER, description: "повторень у запасі (0-4)" },
    restSec: { type: Type.INTEGER },
    notes: { type: Type.STRING, description: "коротка техніка/підказка, до 80 символів" },
  },
  required: ["name", "sets", "reps", "rir", "restSec"],
};

const schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "2-3 речення: що це за план і чому саме такий" },
    nutrition: {
      type: Type.OBJECT,
      properties: {
        kcal: { type: Type.INTEGER },
        protein: { type: Type.INTEGER, description: "г/день" },
        fat: { type: Type.INTEGER, description: "г/день" },
        carbs: { type: Type.INTEGER, description: "г/день" },
        waterMl: { type: Type.INTEGER },
        rationale: { type: Type.STRING, description: "як пораховано: BMR формула, коефіцієнт активності, дефіцит/профіцит, г/кг" },
      },
      required: ["kcal", "protein", "fat", "carbs", "waterMl", "rationale"],
    },
    weeklyRateNote: { type: Type.STRING, description: "очікуваний темп зміни ваги на тиждень і коли коригувати калорії" },
    principles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4-6 принципів з посиланням на дослідження в дужках" },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "напр. «День A — Верх»" },
          focus: { type: Type.STRING },
          exercises: { type: Type.ARRAY, items: exercise },
        },
        required: ["name", "focus", "exercises"],
      },
    },
    progression: { type: Type.STRING, description: "правило прогресії навантаження (подвійна прогресія тощо)" },
    deload: { type: Type.STRING },
    references: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Автор, рік — тема. Лише реальні відомі праці." },
  },
  required: ["summary", "nutrition", "weeklyRateNote", "principles", "days", "progression", "deload", "references"],
};

const clamp = (n: unknown, lo: number, hi: number, d: number) => {
  const x = Number(n);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
};

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => ({}))) as Partial<TrainingAnswers>;
  if (!raw.goal || !(raw.goal in GOALS)) return NextResponse.json({ error: "Обери ціль" }, { status: 400 });

  const a: TrainingAnswers = {
    sex: raw.sex === "f" ? "f" : "m",
    age: clamp(raw.age, 14, 90, 25),
    heightCm: clamp(raw.heightCm, 130, 230, 175),
    weightKg: clamp(raw.weightKg, 35, 250, 75),
    bodyFatPct: raw.bodyFatPct ? clamp(raw.bodyFatPct, 3, 60, 20) : undefined,
    goal: raw.goal,
    level: raw.level && raw.level in LEVELS ? raw.level : "beginner",
    daysPerWeek: clamp(raw.daysPerWeek, 2, 6, 3),
    sessionMin: clamp(raw.sessionMin, 30, 120, 60),
    equipment: raw.equipment && raw.equipment in EQUIPMENT ? raw.equipment : "gym",
    activity: raw.activity && raw.activity in ACTIVITY_LEVELS ? raw.activity : "moderate",
    injuries: raw.injuries?.slice(0, 300),
    notes: raw.notes?.slice(0, 300),
  };

  const prompt = `Ти — тренер із силової підготовки та спортивний нутриціолог, який працює ЛИШЕ на основі доказової бази.
Склади персональний план українською мовою.

ДАНІ:
- Стать: ${a.sex === "m" ? "чоловік" : "жінка"}, вік ${a.age}, зріст ${a.heightCm} см, вага ${a.weightKg} кг${a.bodyFatPct ? `, % жиру ≈ ${a.bodyFatPct}` : ""}
- Ціль: ${GOALS[a.goal]}
- Досвід: ${LEVELS[a.level]}
- Тренувань на тиждень: ${a.daysPerWeek}, тривалість ~${a.sessionMin} хв
- Інвентар: ${EQUIPMENT[a.equipment]}
- Побутова активність: ${ACTIVITY_LEVELS[a.activity]}
${a.injuries ? `- Травми/обмеження: ${a.injuries}` : ""}
${a.notes ? `- Побажання: ${a.notes}` : ""}

ХАРЧУВАННЯ (дотримуйся консенсусу ISSN / дослідів):
- BMR за Міффліном–Сан Жеором (або Кетч–МакАрдлом, якщо відомий % жиру) × коефіцієнт активності з урахуванням тренувань.
- Схуднення: дефіцит ~20–25% (≈0.5–1% маси тіла/тиждень). Сушка: дефіцит ~15–20%, темп 0.5–0.7%/тиждень.
  Набір: профіцит ~5–15% (новачок до +0.5–1% маси/міс, досвідчений 0.25–0.5%). Рекомпозиція/сила/підтримка: близько підтримки.
- Білок 1.6–2.2 г/кг (на дефіциті ближче до 2.2–2.4 г/кг сухої маси) — Morton et al. 2018, Helms et al. 2014.
- Жири 0.6–1 г/кг (не нижче ~20% калорій), решта — вуглеводи.
- Вода ≈ 35 мл/кг + на тренування.

ТРЕНУВАННЯ:
- Обсяг ~10–20 робочих підходів на м'язову групу на тиждень (Schoenfeld 2017), новачку ближче до нижньої межі.
- Кожна група ≥2 рази на тиждень (Schoenfeld 2016). Спліт підбери під ${a.daysPerWeek} днів: 2–3 → full body, 4 → верх/низ, 5–6 → PPL або верх/низ+.
- Інтенсивність: RIR 1–3 (зусилля близько до відмови), базові вправи 4–8 або 5–10 повторень, ізоляція 8–15; для цілі «сила» — більше роботи в 3–6 повторень.
- Відпочинок: базові 2–3 хв, ізоляція 60–90 с (Schoenfeld 2016 rest intervals).
- Вправи ЛИШЕ з доступним інвентарем; врахуй травми (заміни небезпечні рухи).
- Тренування має вкладатися в ~${a.sessionMin} хв. 4–7 вправ на день.
- Прогресія: подвійна прогресія (досяг верхньої межі повторень у всіх підходах → +2.5–5% ваги).
- Розвантаження кожні 4–8 тижнів або за ознаками втоми.

ДЖЕРЕЛА: у references вкажи 4–8 реальних, відомих праць (Автор та ін., рік — тема). НЕ вигадуй неіснуючі статті.
Назви вправ — українською, коротко (напр. «Присідання зі штангою», «Жим гантелей лежачи під кутом 30°»).`;

  try {
    const data = await generateJson<Omit<TrainingPlan, "createdAt">>(prompt, schema, 0.3, {
      timeoutMs: 100_000, // великий план генерується 30–60 с
      deadlineMs: 280_000,
    });
    if (!data.days?.length || !data.nutrition) throw new Error("bad shape");
    const plan: TrainingPlan = { ...data, createdAt: new Date().toISOString() };
    return NextResponse.json({ plan, answers: a });
  } catch (e) {
    console.error("[training]", e);
    return NextResponse.json({ error: "ШІ не відповів. Спробуй ще раз за хвилину." }, { status: 502 });
  }
}
