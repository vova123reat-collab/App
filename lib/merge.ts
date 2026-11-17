import { ATTR_KEYS, DayLog } from "./game";
import type { GameState } from "./store";
import { emptyTraining } from "./training";

const byId = <T extends { id: string }>(a: T[] = [], b: T[] = []) => {
  const m = new Map<string, T>();
  for (const x of b) m.set(x.id, x);
  for (const x of a) m.set(x.id, x); // a (новіший) перемагає
  return [...m.values()];
};

function mergeDay(newer: DayLog, older: DayLog): DayLog {
  const max = (k: "protein" | "water" | "kcal" | "fat" | "carbs") => Math.max(newer[k] ?? 0, older[k] ?? 0);
  return {
    ...newer,
    protein: max("protein"),
    water: max("water"),
    kcal: max("kcal"),
    fat: max("fat"),
    carbs: max("carbs"),
    quests: Array.from(new Set([...(newer.quests ?? []), ...(older.quests ?? [])])),
    foods: byId(newer.foods, older.foods).sort((x, y) => x.at - y.at),
    activities: byId(newer.activities, older.activities).sort((x, y) => x.at - y.at),
  };
}

/**
 * Зливає два стани, що змінились незалежно (два пристрої офлайн / одночасно).
 * Списки (їжа, активності, сесії, тренування, зважування) об'єднуються,
 * налаштування (профіль, план, квести) беруться з новішого стану.
 */
export function mergeStates(a: GameState, b: GameState): GameState {
  const [newer, older] = a.updatedAt >= b.updatedAt ? [a, b] : [b, a];

  const days: Record<string, DayLog> = { ...older.days };
  for (const [date, d] of Object.entries(newer.days ?? {})) {
    days[date] = older.days?.[date] ? mergeDay(d, older.days[date]) : d;
  }

  const olderSkills = new Map((older.skills ?? []).map((s) => [s.id, s]));
  const skills = byId(newer.skills, older.skills).map((s) => {
    const o = olderSkills.get(s.id);
    if (!o || o === s) return s;
    const doneO = new Set(o.stages.flatMap((st) => st.steps.filter((p) => p.done).map((p) => p.id)));
    return {
      ...s,
      minutes: Math.max(s.minutes, o.minutes),
      stages: s.stages.map((st) => ({ ...st, steps: st.steps.map((p) => ({ ...p, done: p.done || doneO.has(p.id) })) })),
    };
  });

  const nt = { ...emptyTraining(), ...(newer.training ?? {}) };
  const ot = { ...emptyTraining(), ...(older.training ?? {}) };

  return {
    ...newer,
    days,
    skills,
    sessions: byId(newer.sessions, older.sessions).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 500),
    xp: Object.fromEntries(ATTR_KEYS.map((k) => [k, Math.max(newer.xp?.[k] ?? 0, older.xp?.[k] ?? 0)])) as GameState["xp"],
    training: {
      ...nt,
      plan: nt.plan ?? ot.plan,
      answers: nt.answers ?? ot.answers,
      logs: byId(nt.logs, ot.logs).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 300),
      bodyWeights: { ...(ot.bodyWeights ?? {}), ...(nt.bodyWeights ?? {}) },
    },
    updatedAt: Math.max(a.updatedAt, b.updatedAt) + 1,
  };
}
