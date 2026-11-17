"use client";
import { useMemo, useState } from "react";
import { Card, Label } from "./ui";
import { useGame } from "@/lib/store";
import {
  EXERCISE_LIBRARY, PlanDay, PlanExercise, planWeekdays, TrainingPlan, WEEKDAYS,
} from "@/lib/training";
import { kcalGoal, proteinGoal, waterGoal } from "@/lib/game";

const newExercise = (): PlanExercise => ({ name: "", sets: 3, reps: "8-12", rir: 2, restSec: 90 });
const newDay = (n: number): PlanDay => ({ name: `День ${n}`, focus: "", exercises: [newExercise()] });

/** Порожній власний план: 3 дні, харчування — з поточних цілей «Палива». */
export function blankPlan(p: ReturnType<typeof useGame.getState>["profile"]): TrainingPlan {
  return {
    createdAt: new Date().toISOString(),
    summary: "Власний план.",
    nutrition: {
      kcal: kcalGoal(p), protein: proteinGoal(p), fat: p.fatGoal ?? Math.round(p.weightKg * 0.9),
      carbs: p.carbsGoal ?? 0, waterMl: waterGoal(p), rationale: "Задано вручну.",
    },
    weeklyRateNote: "",
    principles: [],
    days: [1, 2, 3].map((n, i) => ({ ...newDay(n), weekday: [0, 2, 4][i] })),
    progression: "Подвійна прогресія: коли в усіх підходах досягнуто верхньої межі повторень — додай 2.5–5% ваги.",
    deload: "Кожні 4–8 тижнів — тиждень з половиною обсягу.",
    references: [],
  };
}

const move = <T,>(arr: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

function SmallNum({ label, value, onChange, w = "w-full" }: { label: string; value: number; onChange: (n: number) => void; w?: string }) {
  return (
    <label className={`block text-[10px] text-mute ${w}`}>{label}
      <input inputMode="numeric" value={value || ""} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className="mt-0.5 !px-1.5 !py-1 text-sm text-center" />
    </label>
  );
}

export function PlanEditor({ initial, onClose }: { initial: TrainingPlan; onClose: () => void }) {
  const { setPlan, training } = useGame();
  const [plan, setDraft] = useState<TrainingPlan>(() => {
    // Фіксуємо поточні дні тижня, щоб редагування не зсувало розклад.
    const wd = planWeekdays(initial.days);
    return { ...initial, days: initial.days.map((d, i) => ({ ...d, weekday: d.weekday ?? wd[i] })) };
  });
  const [openDay, setOpenDay] = useState<number | null>(0);
  const [err, setErr] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const fromLogs = training.logs.flatMap((l) => l.exercises.map((e) => e.name));
    const fromPlan = plan.days.flatMap((d) => d.exercises.map((e) => e.name));
    return Array.from(new Set([...fromPlan, ...fromLogs, ...EXERCISE_LIBRARY].filter(Boolean)));
  }, [training.logs, plan.days]);

  const setDays = (days: PlanDay[]) => setDraft({ ...plan, days });
  const setDay = (i: number, patch: Partial<PlanDay>) => setDays(plan.days.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const setEx = (i: number, j: number, patch: Partial<PlanExercise>) =>
    setDay(i, { exercises: plan.days[i].exercises.map((e, k) => (k === j ? { ...e, ...patch } : e)) });
  const n = plan.nutrition;
  const setN = (patch: Partial<TrainingPlan["nutrition"]>) => setDraft({ ...plan, nutrition: { ...n, ...patch } });

  const save = () => {
    const days = plan.days
      .map((d) => ({ ...d, name: d.name.trim() || "День", exercises: d.exercises.filter((e) => e.name.trim()).map((e) => ({ ...e, name: e.name.trim(), sets: Math.max(1, e.sets) })) }))
      .filter((d) => d.exercises.length);
    if (!days.length) return setErr("Додай хоча б одну вправу");
    if (training.active) return setErr("Спершу заверши поточне тренування");
    setPlan({ ...plan, days });
    onClose();
  };

  return (
    <div className="space-y-3 pb-4">
      <datalist id="exercise-names">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>

      <Card className="space-y-2">
        <Label>Харчування на день</Label>
        <div className="grid grid-cols-5 gap-1.5">
          <SmallNum label="ккал" value={n.kcal} onChange={(kcal) => setN({ kcal })} />
          <SmallNum label="білок г" value={n.protein} onChange={(protein) => setN({ protein })} />
          <SmallNum label="жири г" value={n.fat} onChange={(fat) => setN({ fat })} />
          <SmallNum label="вугл. г" value={n.carbs} onChange={(carbs) => setN({ carbs })} />
          <SmallNum label="вода мл" value={n.waterMl} onChange={(waterMl) => setN({ waterMl })} />
        </div>
        {n.protein + n.fat + n.carbs > 0 && (
          <div className="text-[10px] text-mute">
            За БЖВ виходить ≈ {n.protein * 4 + n.fat * 9 + n.carbs * 4} ккал
            {Math.abs(n.protein * 4 + n.fat * 9 + n.carbs * 4 - n.kcal) > 100 && <span className="text-buff"> — не збігається з ккал</span>}
          </div>
        )}
      </Card>

      <Label>Дні тренувань</Label>
      {plan.days.map((d, i) => (
        <Card key={i} className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input value={d.name} onChange={(e) => setDay(i, { name: e.target.value })} className="text-sm font-bold" placeholder={`День ${i + 1}`} />
            <select value={d.weekday ?? 0} onChange={(e) => setDay(i, { weekday: Number(e.target.value) })} className="!w-auto text-sm">
              {WEEKDAYS.map((w, k) => <option key={w} value={k}>{w}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button className="btn !px-2 !py-1" onClick={() => setOpenDay(openDay === i ? null : i)}>
              {openDay === i ? "▾ згорнути" : `▸ ${d.exercises.filter((e) => e.name).length} вправ`}
            </button>
            <span className="flex-1" />
            <button className="btn !px-2 !py-1" onClick={() => { setDays(move(plan.days, i, -1)); setOpenDay(i - 1); }} disabled={i === 0} aria-label="Вгору">↑</button>
            <button className="btn !px-2 !py-1" onClick={() => { setDays(move(plan.days, i, 1)); setOpenDay(i + 1); }} disabled={i === plan.days.length - 1} aria-label="Вниз">↓</button>
            <button className="btn !px-2 !py-1" onClick={() => setDays([...plan.days.slice(0, i + 1), { ...d, name: `${d.name} (копія)` }, ...plan.days.slice(i + 1)])} aria-label="Дублювати">⧉</button>
            <button className="btn !px-2 !py-1 text-hp" onClick={() => confirm(`Видалити «${d.name}»?`) && setDays(plan.days.filter((_, k) => k !== i))} aria-label="Видалити день">✕</button>
          </div>

          {openDay === i && (
            <div className="space-y-2">
              {d.exercises.map((e, j) => (
                <div key={j} className="rounded-md border border-line p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 shrink-0 text-xs text-mute">{j + 1}.</span>
                    <input list="exercise-names" value={e.name} onChange={(ev) => setEx(i, j, { name: ev.target.value })}
                      placeholder="назва вправи" className="text-sm" />
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <SmallNum label="підходи" value={e.sets} onChange={(sets) => setEx(i, j, { sets })} />
                    <label className="block text-[10px] text-mute">повтори
                      <input value={e.reps} onChange={(ev) => setEx(i, j, { reps: ev.target.value.replace(/[^\d\-–]/g, "") })}
                        className="mt-0.5 !px-1.5 !py-1 text-sm text-center" />
                    </label>
                    <SmallNum label="RIR" value={e.rir} onChange={(rir) => setEx(i, j, { rir: Math.min(5, rir) })} />
                    <SmallNum label="відп., с" value={e.restSec} onChange={(restSec) => setEx(i, j, { restSec })} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input value={e.notes ?? ""} onChange={(ev) => setEx(i, j, { notes: ev.target.value })} placeholder="підказка (необов'язково)" className="!py-1 text-xs" />
                    <button className="btn !px-2 !py-1 text-xs" disabled={j === 0} onClick={() => setDay(i, { exercises: move(d.exercises, j, -1) })} aria-label="Вгору">↑</button>
                    <button className="btn !px-2 !py-1 text-xs" disabled={j === d.exercises.length - 1} onClick={() => setDay(i, { exercises: move(d.exercises, j, 1) })} aria-label="Вниз">↓</button>
                    <button className="btn !px-2 !py-1 text-xs text-hp" onClick={() => setDay(i, { exercises: d.exercises.filter((_, k) => k !== j) })} aria-label="Видалити вправу">✕</button>
                  </div>
                </div>
              ))}
              <button className="btn w-full text-xs" onClick={() => setDay(i, { exercises: [...d.exercises, newExercise()] })}>+ вправа</button>
            </div>
          )}
        </Card>
      ))}

      <button className="btn w-full" disabled={plan.days.length >= 7}
        onClick={() => {
          const used = new Set(plan.days.map((d) => d.weekday));
          const free = [0, 1, 2, 3, 4, 5, 6].find((k) => !used.has(k)) ?? 0;
          setDays([...plan.days, { ...newDay(plan.days.length + 1), weekday: free }]);
          setOpenDay(plan.days.length);
        }}>
        + день
      </button>

      {err && <div className="text-xs text-hp">{err}</div>}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex gap-2 bg-bg/90 py-2 backdrop-blur">
        <button className="btn flex-1" onClick={() => confirm("Скасувати зміни?") && onClose()}>Скасувати</button>
        <button className="btn btn-primary flex-[2]" onClick={save}>ЗБЕРЕГТИ ПЛАН</button>
      </div>
    </div>
  );
}
