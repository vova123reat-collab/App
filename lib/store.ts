"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addDays, Attr, BUFF_MULT, DayLog, DEFAULT_QUESTS, dayFueled, emptyDay, HP_GAIN_PER_QUEST,
  HP_LOSS_PER_MISSED_QUEST, HP_MAX, Profile, Quest, QUEST_XP, Session, Skill, Stage, Timer,
  today, uid,
} from "./game";

export interface GameState {
  profile: Profile;
  xp: { int: number; str: number };
  hp: number;
  hpCheckedThrough: string; // останній день, за який вже нараховано штраф HP
  days: Record<string, DayLog>;
  skills: Skill[];
  sessions: Session[];
  quests: Quest[];
  timer: Timer | null;
  updatedAt: number;
}

interface Actions {
  setProfile: (p: Partial<Profile>) => void;
  addProtein: (g: number) => void;
  addWater: (ml: number) => void;
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
}

export const initialState = (): GameState => ({
  profile: { name: "Гравець", weightKg: 75, proteinPerKg: 1.6, waterPerKg: 33 },
  xp: { int: 0, str: 0 },
  hp: HP_MAX,
  hpCheckedThrough: addDays(today(), -1),
  days: {},
  skills: [],
  sessions: [],
  quests: DEFAULT_QUESTS,
  timer: null,
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

        replaceAll: (state) => set({ ...state }),
      };
    },
    {
      name: "rl-rpg",
      version: 1,
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { profile, xp, hp, hpCheckedThrough, days, skills, sessions, quests, timer, updatedAt } = s;
        return { profile, xp, hp, hpCheckedThrough, days, skills, sessions, quests, timer, updatedAt };
      },
    },
  ),
);

export const snapshot = (): GameState => {
  const { profile, xp, hp, hpCheckedThrough, days, skills, sessions, quests, timer, updatedAt } = useGame.getState();
  return { profile, xp, hp, hpCheckedThrough, days, skills, sessions, quests, timer, updatedAt };
};
