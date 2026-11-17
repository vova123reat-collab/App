// Чиста ігрова логіка: типи, формули рівнів, бафи, HP.

export type Attr = "int" | "str";

export interface Step {
  id: string;
  text: string;
  done: boolean;
}

export interface Stage {
  title: string; // "База і терміни"
  hours: [number, number]; // [1, 3]
  steps: Step[];
}

export interface Skill {
  id: string;
  name: string;
  attr: Attr;
  minutes: number; // скільки хвилин уже вкладено (з 1200)
  stages: Stage[];
  createdAt: string;
}

export interface Session {
  id: string;
  skillId: string;
  stepId: string | null;
  minutes: number;
  xp: number;
  date: string; // YYYY-MM-DD
}

export interface DayLog {
  protein: number; // г
  water: number; // мл
  quests: string[]; // id виконаних квестів
}

export interface Quest {
  id: string;
  title: string;
  attr: Attr;
}

export interface Timer {
  skillId: string;
  stepId: string | null;
  startedAt: number; // ms epoch
}

export interface Profile {
  name: string;
  weightKg: number;
  proteinPerKg: number; // г білка на кг
  waterPerKg: number; // мл води на кг
}

export const SKILL_TARGET_MIN = 20 * 60;
export const QUEST_XP = 15;
export const HP_MAX = 100;
export const HP_LOSS_PER_MISSED_QUEST = 5;
export const HP_GAIN_PER_QUEST = 2;
export const BUFF_MULT = 1.25;

export const STAGE_TEMPLATE: Pick<Stage, "title" | "hours">[] = [
  { title: "База і терміни", hours: [1, 3] },
  { title: "Ізольована механіка", hours: [4, 8] },
  { title: "Комбінація і практика", hours: [9, 15] },
  { title: "Автоматизм · Фінальний Бос", hours: [16, 20] },
];

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return today(d);
};

export const proteinGoal = (p: Profile) => Math.round(p.weightKg * p.proteinPerKg);
export const waterGoal = (p: Profile) => Math.round((p.weightKg * p.waterPerKg) / 50) * 50;

export const emptyDay = (): DayLog => ({ protein: 0, water: 0, quests: [] });

/** Норму закрито → наступного дня баф «Заряджений». */
export const dayFueled = (log: DayLog | undefined, p: Profile) =>
  !!log && log.protein >= proteinGoal(p) && log.water >= waterGoal(p);

/** Сумарний XP, щоб досягти рівня L (L=1 → 0). Крива: 150, 350, 600, 900... */
export const xpForLevel = (L: number) => 25 * (L - 1) * (L + 4);

export function levelInfo(xp: number) {
  let L = 1;
  while (xpForLevel(L + 1) <= xp) L++;
  const from = xpForLevel(L);
  const to = xpForLevel(L + 1);
  return { level: L, into: xp - from, need: to - from, pct: (xp - from) / (to - from) };
}

export function skillStageIndex(minutes: number) {
  const h = minutes / 60;
  if (h < 3) return 0;
  if (h < 8) return 1;
  if (h < 15) return 2;
  return 3;
}

export const fmtHM = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${h}г ${String(m).padStart(2, "0")}хв`;
};

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
};

export const DEFAULT_QUESTS: Quest[] = [
  { id: "q-mobility", title: "Розминка на мобільність (10 хв)", attr: "str" },
  { id: "q-pushups", title: "30 віджимань", attr: "str" },
  { id: "q-read", title: "Читання (20 сторінок)", attr: "int" },
];
