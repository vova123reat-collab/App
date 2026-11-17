// Силові тренування: анкета, план від ШІ, журнал тренувань.

export type Goal = "cut" | "lean" | "bulk" | "recomp" | "strength" | "maintain";
export type Level = "beginner" | "intermediate" | "advanced";
export type Equipment = "gym" | "dumbbells" | "bodyweight";
export type ActivityLevel = "sedentary" | "moderate" | "active";

export const GOALS: Record<Goal, string> = {
  cut: "Схуднення",
  lean: "Сушка (рельєф, зберегти м'язи)",
  bulk: "Набір м'язової маси",
  recomp: "Рекомпозиція (менше жиру + більше м'язів)",
  strength: "Сила",
  maintain: "Підтримка форми",
};
export const LEVELS: Record<Level, string> = {
  beginner: "Новачок (< 6 міс)",
  intermediate: "Середній (6–24 міс)",
  advanced: "Досвідчений (> 2 років)",
};
export const EQUIPMENT: Record<Equipment, string> = {
  gym: "Тренажерний зал",
  dumbbells: "Дім: гантелі / гирі",
  bodyweight: "Власна вага / турнік",
};
export const ACTIVITY_LEVELS: Record<ActivityLevel, string> = {
  sedentary: "Сидяча робота, мало кроків",
  moderate: "Помірно активний (6–10 тис. кроків)",
  active: "Фізична робота / дуже активний",
};

export interface TrainingAnswers {
  sex: "m" | "f";
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number;
  goal: Goal;
  level: Level;
  daysPerWeek: number;
  sessionMin: number;
  equipment: Equipment;
  activity: ActivityLevel;
  injuries?: string;
  notes?: string;
}

export interface PlanExercise {
  name: string;
  sets: number;
  reps: string; // "6-8"
  rir: number; // повторень у запасі
  restSec: number;
  notes?: string;
}

export interface PlanDay {
  name: string; // "День A — Верх"
  focus: string;
  weekday?: number; // 0 = Пн … 6 = Нд; якщо не задано — розкладка за замовчуванням
  exercises: PlanExercise[];
}

export interface TrainingPlan {
  createdAt: string;
  summary: string;
  nutrition: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    waterMl: number;
    rationale: string;
  };
  weeklyRateNote: string; // очікуваний темп зміни ваги
  principles: string[]; // ключові принципи з поясненням
  days: PlanDay[];
  progression: string;
  deload: string;
  references: string[];
}

export interface LoggedSet {
  weight: number;
  reps: number;
  done: boolean;
}

export interface ActiveWorkout {
  dayIndex: number;
  startedAt: number;
  sets: LoggedSet[][]; // [вправа][підхід]
}

export interface WorkoutLog {
  id: string;
  date: string;
  dayName: string;
  minutes: number;
  xp: number;
  exercises: { name: string; sets: { weight: number; reps: number }[] }[];
}

export interface TrainingState {
  bodyWeights?: Record<string, number>; // YYYY-MM-DD → кг
  answers?: TrainingAnswers;
  plan?: TrainingPlan;
  logs: WorkoutLog[];
  active?: ActiveWorkout | null;
}

export const emptyTraining = (): TrainingState => ({ logs: [], active: null });

/** Тоннаж тренування (кг × повтори). */
export const volume = (w: WorkoutLog) =>
  w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0);

/** Останній результат у вправі — підказка «минулого разу». */
export function lastResult(logs: WorkoutLog[], exercise: string) {
  const key = exercise.trim().toLowerCase();
  for (const l of logs) {
    const e = l.exercises.find((x) => x.name.trim().toLowerCase() === key);
    if (e && e.sets.length) {
      const best = e.sets.reduce((a, s) => (s.weight * (1 + s.reps / 30) > a.weight * (1 + a.reps / 30) ? s : a));
      return { date: l.date, best, sets: e.sets };
    }
  }
  return null;
}

/** Оцінка 1ПМ за Еплі — для графіка прогресу. */
export const e1rm = (w: number, r: number) => (r <= 1 ? w : Math.round(w * (1 + r / 30)));

/** XP за тренування: хвилини + бонус за кожен виконаний робочий підхід. */
export const workoutXp = (minutes: number, doneSets: number) => Math.round(minutes * 0.8 + doneSets * 2);

// ───────────── Прогрес ─────────────

export interface Point { date: string; y: number; label?: string }

/** Найкращий результат (оцінка 1ПМ) у вправі за кожне тренування, від старих до нових. */
export function exerciseSeries(logs: WorkoutLog[], exercise: string): Point[] {
  const key = exercise.trim().toLowerCase();
  const byDate = new Map<string, Point>();
  for (const l of [...logs].reverse()) {
    const e = l.exercises.find((x) => x.name.trim().toLowerCase() === key);
    if (!e) continue;
    const loaded = e.sets.filter((s) => s.weight > 0);
    if (!loaded.length) continue;
    const best = loaded.reduce((a, s) => (e1rm(s.weight, s.reps) > e1rm(a.weight, a.reps) ? s : a));
    const p = { date: l.date, y: e1rm(best.weight, best.reps), label: `${best.weight} кг × ${best.reps}` };
    const prev = byDate.get(l.date);
    if (!prev || p.y > prev.y) byDate.set(l.date, p);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Вправи з вагою, які є в журналі (за кількістю тренувань). */
export function trackedExercises(logs: WorkoutLog[]) {
  const count = new Map<string, number>();
  for (const l of logs) for (const e of l.exercises) if (e.sets.some((s) => s.weight > 0)) count.set(e.name, (count.get(e.name) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

const dayNum = (iso: string) => Date.parse(iso + "T12:00:00Z") / 86_400_000;

/** Тренд ваги: середнє за 7 днів до кожної точки (згладжує коливання води). */
export function weightTrend(points: Point[]): Point[] {
  return points.map((p) => {
    const win = points.filter((q) => dayNum(q.date) <= dayNum(p.date) && dayNum(q.date) > dayNum(p.date) - 7);
    return { date: p.date, y: Math.round((win.reduce((a, q) => a + q.y, 0) / win.length) * 10) / 10 };
  });
}

/** Темп зміни ваги, кг/тиждень (лінійна регресія по тренду за останні 28 днів). */
export function weeklyRate(trend: Point[]): number | null {
  if (trend.length < 2) return null;
  const last = dayNum(trend[trend.length - 1].date);
  const pts = trend.filter((p) => dayNum(p.date) > last - 28);
  if (pts.length < 2 || dayNum(pts[pts.length - 1].date) - dayNum(pts[0].date) < 6) return null;
  const xs = pts.map((p) => dayNum(p.date)), ys = pts.map((p) => p.y);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den ? Math.round((num / den) * 7 * 100) / 100 : null;
}

// ───────────── Розклад і бібліотека вправ ─────────────

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
/** Рекомендовані дні тижня (Пн=0) з відпочинком між тренуваннями. */
export const DEFAULT_SCHEDULES: Record<number, number[]> = {
  1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
};
/** День тижня для кожного тренування: власний, якщо задано, інакше з розкладки. */
export const planWeekdays = (days: PlanDay[]) => {
  const def = DEFAULT_SCHEDULES[Math.min(7, Math.max(1, days.length))] ?? [];
  return days.map((d, i) => d.weekday ?? def[i] ?? i % 7);
};

export const EXERCISE_LIBRARY = [
  // Груди
  "Жим штанги лежачи", "Жим гантелей лежачи", "Жим гантелей під кутом 30°", "Жим штанги під кутом", "Віджимання від підлоги",
  "Віджимання на брусах", "Зведення в кросовері", "Розведення гантелей лежачи", "Жим у тренажері Хаммер",
  // Спина
  "Підтягування", "Підтягування зворотним хватом", "Тяга верхнього блока", "Тяга штанги в нахилі", "Тяга гантелі однією рукою",
  "Тяга горизонтального блока", "Станова тяга", "Румунська тяга", "Гіперекстензія", "Пуловер на блоці",
  // Плечі
  "Жим штанги стоячи", "Жим гантелей сидячи", "Розведення гантелей в сторони", "Розведення в нахилі", "Тяга канату до обличчя",
  // Руки
  "Підйом штанги на біцепс", "Підйом гантелей на біцепс", "Молоткові згинання", "Французький жим", "Розгинання на блоці (трицепс)",
  "Жим вузьким хватом",
  // Ноги
  "Присідання зі штангою", "Фронтальні присідання", "Гоблет-присідання", "Жим ногами", "Випади з гантелями",
  "Болгарські спліт-присідання", "Сідничний місток зі штангою", "Розгинання ніг у тренажері", "Згинання ніг лежачи",
  "Підйом на носки стоячи",
  // Кор
  "Планка", "Підйом ніг у висі", "Скручування на блоці", "Колесо для преса",
];
