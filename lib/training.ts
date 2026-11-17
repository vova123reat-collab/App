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
