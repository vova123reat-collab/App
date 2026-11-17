"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Activity, ActivityEntry, addDays, Attr, BUFF_MULT, DayLog, DEFAULT_QUESTS, dayFueled, emptyDay, emptyXp,
  FoodEntry, HP_GAIN_PER_QUEST, HP_LOSS_PER_MISSED_QUEST, HP_MAX, Nutrition, Profile, Quest, QUEST_XP,
  Session, Skill, Stage, Timer, today, uid,
} from "./game";
import { ACTIVITIES } from "./game";
import {
  ActiveWorkout, emptyTraining, LoggedSet, TrainingAnswers, TrainingPlan, TrainingState, WorkoutLog, workoutXp,
} from "./training";

export interface GameState {
  profile: Profile;
  xp: Record<Attr, number>;
  hp: number;
  hpCheckedThrough: string; // останній день, за який вже нараховано штраф HP
  days: Record<string, DayLog>;
  skills: Skill[];
  sessions: Session[];
  quests: Quest[];
  timer: Timer | null;
  training: TrainingState;
  updatedAt: number;
}

interface Actions {
  setProfile: (p: Partial<Profile>) => void;
  addProtein: (g: number) => void;
  addWater: (ml: number) => void;
  addFoods: (items: (Nutrition & { name: string; grams: number })[]) => void;
  removeFood: (id: string) => void;
  logActivity: (a: Activity, amount: number) => ActivityEntry;
  removeActivity: (id: string) => void;
  toggleQuest: (id: string) => void;
  addQuest: (title: string, attr: Attr) => void;
  removeQuest: (id: string) => void;
  addSkill: (name: string, attr: Attr, stages: Stage[]) => void;
  removeSkill: (id: string) => void;
  toggleStep: (skillId: string, stepId: string) => void;
  startTimer: (skillId: string, stepId: string | null) => void;
  stopTimer: () => Session | null;
  cancelTimer: () => void;
  applyDailyTick: () => void;
  replaceAll: (s: GameState) => void;
  setTrainingAnswers: (a: TrainingAnswers) => void;
  setPlan: (p: TrainingPlan | undefined) => void;
  applyPlanNutrition: () => void;
  startWorkout: (dayIndex: number) => void;
  updateSet: (ex: number, set: number, patch: Partial<LoggedSet>) => void;
  addSet: (ex: number) => void;
  finishWorkout: () => WorkoutLog | null;
  cancelWorkout: () => void;
  deleteWorkoutLog: (id: string) => void;
  logBodyWeight: (kg: number, date?: string) => void;
  removeBodyWeight: (date: string) => void;
}

export const initialState = (): GameState => ({
  profile: { name: "Гравець", weightKg: 75, proteinPerKg: 1.6, waterPerKg: 33 },
  xp: emptyXp(),
  hp: HP_MAX,
  hpCheckedThrough: addDays(today(), -1),
  days: {},
  skills: [],
  sessions: [],
  quests: DEFAULT_QUESTS,
  timer: null,
  training: emptyTraining(),
  updatedAt: Date.now(),
});

/** Баф на сьогодні = норму закрито вчора. */
export const isBuffed = (s: GameState) => dayFueled(s.days[addDays(today(), -1)], s.profile);
export const todayLog = (s: GameState) => s.days[today()] ?? emptyDay();

const touch = <T extends object>(patch: T) => ({ ...patch, updatedAt: Date.now() });

export const useGame = create<GameState & Actions>()(
  persist(
    (set, get) => {
      const updateDay = (fn: (d: DayLog) => DayLog) => {
        const key = today();
        const days = { ...get().days, [key]: fn(get().days[key] ?? emptyDay()) };
        set(touch({ days }));
      };

      return {
        ...initialState(),

        setProfile: (p) => set(touch({ profile: { ...get().profile, ...p } })),

        addProtein: (g) => updateDay((d) => ({ ...d, protein: Math.max(0, d.protein + g) })),
        addWater: (ml) => updateDay((d) => ({ ...d, water: Math.max(0, d.water + ml) })),

        addFoods: (items) =>
          updateDay((d) => {
            const entries: FoodEntry[] = items.map((x) => ({ ...x, id: uid(), at: Date.now() }));
            const sum = (k: keyof Nutrition) => entries.reduce((a, e) => a + e[k], 0);
            const r1 = (x: number) => Math.round(x * 10) / 10;
            return {
              ...d,
              foods: [...(d.foods ?? []), ...entries],
              protein: Math.round(d.protein + sum("protein")),
              kcal: Math.round((d.kcal ?? 0) + sum("kcal")),
              fat: r1((d.fat ?? 0) + sum("fat")),
              carbs: r1((d.carbs ?? 0) + sum("carbs")),
            };
          }),

        removeFood: (id) =>
          updateDay((d) => {
            const f = d.foods?.find((x) => x.id === id);
            if (!f) return d;
            const r1 = (x: number) => Math.max(0, Math.round(x * 10) / 10);
            return {
              ...d,
              foods: d.foods!.filter((x) => x.id !== id),
              protein: Math.max(0, Math.round(d.protein - f.protein)),
              kcal: Math.max(0, Math.round((d.kcal ?? 0) - f.kcal)),
              fat: r1((d.fat ?? 0) - f.fat),
              carbs: r1((d.carbs ?? 0) - f.carbs),
            };
          }),

        logActivity: (a, amount) => {
          const s = get();
          const mult = isBuffed(s) ? BUFF_MULT : 1;
          const units = a.kind === "once" ? 1 : amount;
          const entry: ActivityEntry = {
            id: uid(), activityId: a.id, amount: units, attr: a.attr,
            xp: Math.round(units * a.xpPerUnit * mult), at: Date.now(),
          };
          updateDay((d) => ({ ...d, activities: [...(d.activities ?? []), entry] }));
          set(touch({ xp: { ...get().xp, [a.attr]: get().xp[a.attr] + entry.xp } }));
          return entry;
        },

        removeActivity: (id) => {
          const e = todayLog(get()).activities?.find((x) => x.id === id);
          if (!e) return;
          updateDay((d) => ({ ...d, activities: (d.activities ?? []).filter((x) => x.id !== id) }));
          const xp = get().xp;
          set(touch({ xp: { ...xp, [e.attr]: Math.max(0, xp[e.attr] - e.xp) } }));
        },

        toggleQuest: (id) => {
          const s = get();
          const q = s.quests.find((x) => x.id === id);
          if (!q) return;
          const done = todayLog(s).quests.includes(id);
          const mult = isBuffed(s) ? BUFF_MULT : 1;
          const dxp = Math.round(QUEST_XP * mult) * (done ? -1 : 1);
          updateDay((d) => ({
            ...d,
            quests: done ? d.quests.filter((x) => x !== id) : [...d.quests, id],
          }));
          set(touch({
            xp: { ...s.xp, [q.attr]: Math.max(0, s.xp[q.attr] + dxp) },
            hp: Math.min(HP_MAX, Math.max(0, s.hp + (done ? -HP_GAIN_PER_QUEST : HP_GAIN_PER_QUEST))),
          }));
        },

        addQuest: (title, attr) => set(touch({ quests: [...get().quests, { id: uid(), title, attr }] })),
        removeQuest: (id) => set(touch({ quests: get().quests.filter((q) => q.id !== id) })),

        addSkill: (name, attr, stages) =>
          set(touch({
            skills: [
              ...get().skills,
              { id: uid(), name, attr, minutes: 0, stages, createdAt: new Date().toISOString() },
            ],
          })),

        removeSkill: (id) => {
          const s = get();
          set(touch({
            skills: s.skills.filter((k) => k.id !== id),
            timer: s.timer?.skillId === id ? null : s.timer,
          }));
        },

        toggleStep: (skillId, stepId) =>
          set(touch({
            skills: get().skills.map((k) =>
              k.id !== skillId ? k : {
                ...k,
                stages: k.stages.map((st) => ({
                  ...st,
                  steps: st.steps.map((p) => (p.id === stepId ? { ...p, done: !p.done } : p)),
                })),
              }),
          })),

        startTimer: (skillId, stepId) => set(touch({ timer: { skillId, stepId, startedAt: Date.now() } })),
        cancelTimer: () => set(touch({ timer: null })),

        stopTimer: () => {
          const s = get();
          if (!s.timer) return null;
          const minutes = Math.floor((Date.now() - s.timer.startedAt) / 60000);
          const skill = s.skills.find((k) => k.id === s.timer!.skillId);
          if (!skill || minutes < 1) {
            set(touch({ timer: null }));
            return null;
          }
          const xp = Math.round(minutes * (isBuffed(s) ? BUFF_MULT : 1));
          const session: Session = {
            id: uid(), skillId: skill.id, stepId: s.timer.stepId, minutes, xp, date: today(),
          };
          set(touch({
            timer: null,
            sessions: [session, ...s.sessions].slice(0, 500),
            skills: s.skills.map((k) => (k.id === skill.id ? { ...k, minutes: k.minutes + minutes } : k)),
            xp: { ...s.xp, [skill.attr]: s.xp[skill.attr] + xp },
          }));
          return session;
        },

        /** Для кожного завершеного дня: −HP за кожен пропущений квест. */
        applyDailyTick: () => {
          const s = get();
          const yesterday = addDays(today(), -1);
          let day = addDays(s.hpCheckedThrough, 1);
          let hp = s.hp;
          let guard = 0;
          while (day <= yesterday && guard++ < 60) {
            const done = s.days[day]?.quests.length ?? 0;
            const missed = Math.max(0, s.quests.length - done);
            hp = Math.max(0, hp - missed * HP_LOSS_PER_MISSED_QUEST);
            day = addDays(day, 1);
          }
          if (hp !== s.hp || s.hpCheckedThrough !== yesterday) {
            set(touch({ hp, hpCheckedThrough: yesterday }));
          }
        },

        replaceAll: (state) => set(normalize(state)),

        setTrainingAnswers: (a) => set(touch({ training: { ...get().training, answers: a } })),
        setPlan: (p) => set(touch({ training: { ...get().training, plan: p, active: null } })),

        /** Переносить КБЖВ з плану в цілі «Палива». */
        applyPlanNutrition: () => {
          const { training, profile } = get();
          const n = training.plan?.nutrition;
          if (!n) return;
          const w = training.answers?.weightKg ?? profile.weightKg;
          set(touch({
            profile: {
              ...profile,
              weightKg: w,
              proteinPerKg: Math.round((n.protein / w) * 100) / 100,
              waterPerKg: n.waterMl ? Math.round(n.waterMl / w) : profile.waterPerKg,
              kcalGoal: n.kcal,
              fatGoal: n.fat,
              carbsGoal: n.carbs,
            },
          }));
        },

        startWorkout: (dayIndex) => {
          const day = get().training.plan?.days[dayIndex];
          if (!day) return;
          const active: ActiveWorkout = {
            dayIndex,
            startedAt: Date.now(),
            sets: day.exercises.map((e) => Array.from({ length: e.sets }, () => ({ weight: 0, reps: 0, done: false }))),
          };
          set(touch({ training: { ...get().training, active } }));
        },

        updateSet: (ex, si, patch) => {
          const t = get().training;
          if (!t.active) return;
          const sets = t.active.sets.map((row, i) => (i !== ex ? row : row.map((st, j) => (j === si ? { ...st, ...patch } : st))));
          set(touch({ training: { ...t, active: { ...t.active, sets } } }));
        },

        addSet: (ex) => {
          const t = get().training;
          if (!t.active) return;
          const sets = t.active.sets.map((row, i) => {
            if (i !== ex) return row;
            const last = row[row.length - 1];
            return [...row, { weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false }];
          });
          set(touch({ training: { ...t, active: { ...t.active, sets } } }));
        },

        cancelWorkout: () => set(touch({ training: { ...get().training, active: null } })),

        finishWorkout: () => {
          const s = get();
          const t = s.training;
          const day = t.plan?.days[t.active?.dayIndex ?? -1];
          if (!t.active || !day) return null;
          const minutes = Math.max(1, Math.round((Date.now() - t.active.startedAt) / 60000));
          const exercises = day.exercises
            .map((e, i) => ({
              name: e.name,
              sets: (t.active!.sets[i] ?? []).filter((x) => x.done).map(({ weight, reps }) => ({ weight, reps })),
            }))
            .filter((e) => e.sets.length);
          const doneSets = exercises.reduce((a, e) => a + e.sets.length, 0);
          if (!doneSets) {
            set(touch({ training: { ...t, active: null } }));
            return null;
          }
          const xp = Math.round(workoutXp(minutes, doneSets) * (isBuffed(s) ? BUFF_MULT : 1));
          const log: WorkoutLog = { id: uid(), date: today(), dayName: day.name, minutes, xp, exercises };
          const strength = ACTIVITIES.find((a) => a.id === "a-strength")!;
          const entry: ActivityEntry = { id: uid(), activityId: strength.id, amount: minutes, attr: "str", xp, at: Date.now() };
          updateDay((d) => ({ ...d, activities: [...(d.activities ?? []), entry] }));
          set(touch({
            training: { ...t, active: null, logs: [log, ...t.logs].slice(0, 300) },
            xp: { ...get().xp, str: get().xp.str + xp },
          }));
          return log;
        },

        logBodyWeight: (kg, date = today()) => {
          const t = get().training;
          const bodyWeights = { ...(t.bodyWeights ?? {}), [date]: Math.round(kg * 10) / 10 };
          const latest = Object.keys(bodyWeights).sort().pop()!;
          set(touch({
            training: { ...t, bodyWeights },
            profile: { ...get().profile, weightKg: bodyWeights[latest] }, // цілі білка/води рахуються від свіжої ваги
          }));
        },

        removeBodyWeight: (date) => {
          const t = get().training;
          const bodyWeights = { ...(t.bodyWeights ?? {}) };
          delete bodyWeights[date];
          set(touch({ training: { ...t, bodyWeights } }));
        },

        deleteWorkoutLog: (id) => set(touch({ training: { ...get().training, logs: get().training.logs.filter((l) => l.id !== id) } })),
      };
    },
    {
      name: "rl-rpg",
      version: 2,
      migrate: (persisted) => normalize(persisted as GameState),
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { profile, xp, hp, hpCheckedThrough, days, skills, sessions, quests, timer, training, updatedAt } = s;
        return { profile, xp, hp, hpCheckedThrough, days, skills, sessions, quests, timer, training, updatedAt };
      },
    },
  ),
);

/** Приводить старі збереження (v1: лише INT/STR) до поточної форми. */
export function normalize(s: GameState): GameState {
  return {
    ...initialState(),
    ...s,
    xp: { ...emptyXp(), ...(s?.xp ?? {}) },
    training: { ...emptyTraining(), ...(s?.training ?? {}) },
  };
}

export const snapshot = (): GameState => {
  const { profile, xp, hp, hpCheckedThrough, days, skills, sessions, quests, timer, training, updatedAt } = useGame.getState();
  return { profile, xp, hp, hpCheckedThrough, days, skills, sessions, quests, timer, training, updatedAt };
};
