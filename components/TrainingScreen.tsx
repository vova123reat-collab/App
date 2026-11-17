"use client";
import { useEffect, useState } from "react";
import { Card, Label } from "./ui";
import { useGame } from "@/lib/store";
import {
  ACTIVITY_LEVELS, e1rm, EQUIPMENT, GOALS, lastResult, LEVELS, TrainingAnswers, volume, WorkoutLog,
} from "@/lib/training";
import { fmtClock, kcalGoal, proteinGoal } from "@/lib/game";

// ───────────── Анкета ─────────────

function Select<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Record<T, string>; onChange: (v: T) => void;
}) {
  return (
    <label className="block text-xs text-mute">{label}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="mt-1 text-sm">
        {(Object.keys(options) as T[]).map((k) => <option key={k} value={k}>{options[k]}</option>)}
      </select>
    </label>
  );
}

function Num({ label, value, onChange, step = 1 }: { label: string; value?: number; onChange: (n: number | undefined) => void; step?: number }) {
  return (
    <label className="block text-xs text-mute">{label}
      <input inputMode="decimal" step={step} value={value ?? ""} className="mt-1 text-sm"
        onChange={(e) => { const v = e.target.value.replace(",", "."); onChange(v === "" ? undefined : Number(v) || 0); }} />
    </label>
  );
}

function Questionnaire({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { profile, training, setTrainingAnswers, setPlan } = useGame();
  const [a, setA] = useState<TrainingAnswers>(() => training.answers ?? {
    sex: "m", age: 25, heightCm: 178, weightKg: profile.weightKg, goal: "recomp", level: "beginner",
    daysPerWeek: 3, sessionMin: 60, equipment: "gym", activity: "moderate",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const up = (p: Partial<TrainingAnswers>) => setA({ ...a, ...p });

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/training", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setTrainingAnswers(j.answers);
      setPlan(j.plan);
      onDone();
    } catch (e) { setErr((e as Error).message || "Помилка"); }
    finally { setBusy(false); }
  };

  return (
    <Card className="space-y-3">
      <div className="flex justify-between items-center">
        <b>Анкета для плану</b>
        {onCancel && <button className="text-mute text-sm" onClick={onCancel}>✕</button>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select label="Стать" value={a.sex} options={{ m: "Чоловік", f: "Жінка" }} onChange={(sex) => up({ sex })} />
        <Num label="Вік" value={a.age} onChange={(n) => up({ age: n ?? 0 })} />
        <Num label="Зріст, см" value={a.heightCm} onChange={(n) => up({ heightCm: n ?? 0 })} />
        <Num label="Вага, кг" value={a.weightKg} step={0.1} onChange={(n) => up({ weightKg: n ?? 0 })} />
        <Num label="% жиру (якщо знаєш)" value={a.bodyFatPct} onChange={(n) => up({ bodyFatPct: n })} />
        <Select label="Досвід" value={a.level} options={LEVELS} onChange={(level) => up({ level })} />
      </div>
      <Select label="Ціль" value={a.goal} options={GOALS} onChange={(goal) => up({ goal })} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-mute">Днів на тиждень
          <select value={a.daysPerWeek} onChange={(e) => up({ daysPerWeek: Number(e.target.value) })} className="mt-1 text-sm">
            {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="block text-xs text-mute">Тривалість
          <select value={a.sessionMin} onChange={(e) => up({ sessionMin: Number(e.target.value) })} className="mt-1 text-sm">
            {[30, 45, 60, 75, 90].map((n) => <option key={n} value={n}>{n} хв</option>)}
          </select>
        </label>
      </div>
      <Select label="Інвентар" value={a.equipment} options={EQUIPMENT} onChange={(equipment) => up({ equipment })} />
      <Select label="Активність поза залом" value={a.activity} options={ACTIVITY_LEVELS} onChange={(activity) => up({ activity })} />
      <label className="block text-xs text-mute">Травми / обмеження
        <input value={a.injuries ?? ""} onChange={(e) => up({ injuries: e.target.value })} placeholder="напр. болить коліно при глибокому присіді" className="mt-1 text-sm" />
      </label>
      <label className="block text-xs text-mute">Побажання
        <input value={a.notes ?? ""} onChange={(e) => up({ notes: e.target.value })} placeholder="напр. хочу підтягування, акцент на плечі" className="mt-1 text-sm" />
      </label>
      <button className="btn btn-primary w-full" onClick={generate} disabled={busy}>
        {busy ? "ШІ складає план… (до 1 хв)" : "✦ СКЛАСТИ ПЛАН"}
      </button>
      {err && <div className="text-xs text-hp">{err}</div>}
      <div className="text-[10px] text-mute">
        План складається за науковим консенсусом (ISSN, Schoenfeld, Morton та ін.), але це не медична порада.
        За хвороб чи травм — порадься з лікарем.
      </div>
    </Card>
  );
}

// ───────────── Режим тренування ─────────────

function RestTimer({ until, onEnd }: { until: number; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) {
        onEnd();
        try { navigator.vibrate?.([200, 100, 200]); } catch {}
      }
    }, 250);
    return () => clearInterval(t);
  }, [until, onEnd]);
  const left = Math.max(0, until - now);
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md px-4">
      <div className="card flex items-center justify-between px-4 py-2 border-buff/50">
        <span className="text-xs text-mute">Відпочинок</span>
        <span className="text-2xl font-bold tabular-nums text-buff">{fmtClock(left).slice(3)}</span>
        <button className="btn text-xs" onClick={onEnd}>Пропустити</button>
      </div>
    </div>
  );
}

function WorkoutMode({ onFinished }: { onFinished: (l: WorkoutLog | null) => void }) {
  const { training, updateSet, addSet, finishWorkout, cancelWorkout } = useGame();
  const active = training.active!;
  const day = training.plan!.days[active.dayIndex];
  const [now, setNow] = useState(Date.now());
  const [restUntil, setRestUntil] = useState<number | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const done = active.sets.flat().filter((s) => s.done).length;
  const total = active.sets.flat().length;

  return (
    <div className="space-y-3 pb-16">
      <Card className="flex items-center justify-between">
        <div>
          <b>{day.name}</b>
          <div className="text-[11px] text-mute">{day.focus}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tabular-nums">{fmtClock(now - active.startedAt)}</div>
          <div className="text-[11px] text-mute">{done}/{total} підходів</div>
        </div>
      </Card>

      {day.exercises.map((ex, i) => {
        const prev = lastResult(training.logs, ex.name);
        return (
          <Card key={i}>
            <div className="flex justify-between gap-2">
              <b className="text-sm">{ex.name}</b>
              <span className="shrink-0 text-[11px] text-mute">{ex.sets}×{ex.reps} · RIR {ex.rir}</span>
            </div>
            {ex.notes && <div className="text-[11px] text-mute">{ex.notes}</div>}
            {prev && (
              <div className="mt-1 text-[11px] text-xp">
                минулого разу: {prev.sets.map((s) => `${s.weight}×${s.reps}`).join(", ")}
              </div>
            )}
            <div className="mt-2 space-y-1.5">
              {(active.sets[i] ?? []).map((st, j) => (
                <div key={j} className={`flex items-center gap-2 ${st.done ? "opacity-60" : ""}`}>
                  <span className="w-5 text-xs text-mute">{j + 1}</span>
                  <input inputMode="decimal" placeholder={prev ? String(prev.best.weight) : "кг"} value={st.weight || ""}
                    onChange={(e) => updateSet(i, j, { weight: Number(e.target.value.replace(",", ".")) || 0 })}
                    className="!w-20 !py-1.5 text-sm text-center" />
                  <span className="text-xs text-mute">кг ×</span>
                  <input inputMode="numeric" placeholder={ex.reps.split(/[-–]/)[0]} value={st.reps || ""}
                    onChange={(e) => updateSet(i, j, { reps: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                    className="!w-14 !py-1.5 text-sm text-center" />
                  <button
                    className={`ml-auto size-9 rounded-md border text-sm ${st.done ? "border-xp bg-xp/15 text-xp" : "border-line"}`}
                    onClick={() => {
                      const willBeDone = !st.done;
                      const patch: Partial<typeof st> = { done: willBeDone };
                      // Порожні поля → беремо підказку (минулий результат / нижню межу повторень).
                      if (willBeDone && !st.weight && prev) patch.weight = prev.best.weight;
                      if (willBeDone && !st.reps) patch.reps = Number(ex.reps.split(/[-–]/)[0]) || 0;
                      updateSet(i, j, patch);
                      if (willBeDone) setRestUntil(Date.now() + ex.restSec * 1000);
                    }}
                  >✓</button>
                </div>
              ))}
            </div>
            <button className="mt-2 text-[11px] text-mute" onClick={() => addSet(i)}>+ підхід</button>
          </Card>
        );
      })}

      <div className="flex gap-2">
        <button className="btn flex-1 text-mute" onClick={() => confirm("Скасувати тренування без збереження?") && cancelWorkout()}>Скасувати</button>
        <button className="btn btn-primary flex-[2]" onClick={() => onFinished(finishWorkout())} disabled={!done}>ЗАВЕРШИТИ ✓</button>
      </div>

      {restUntil && <RestTimer until={restUntil} onEnd={() => setRestUntil(null)} />}
    </div>
  );
}

// ───────────── План ─────────────

function PlanView({ onEdit }: { onEdit: () => void }) {
  const { training, profile, startWorkout, applyPlanNutrition, deleteWorkoutLog } = useGame();
  const plan = training.plan!;
  const n = plan.nutrition;
  const [open, setOpen] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const applied = kcalGoal(profile) === n.kcal && proteinGoal(profile) === n.protein;

  // Наступний день по колу після останнього виконаного.
  const lastIdx = plan.days.findIndex((d) => d.name === training.logs[0]?.dayName);
  const next = (lastIdx + 1) % plan.days.length;

  return (
    <div className="space-y-3">
      <Card>
        <div className="text-sm">{plan.summary}</div>
      </Card>

      <Card className="space-y-2">
        <Label>Харчування на день</Label>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[["ккал", n.kcal, "text-buff"], ["білок", n.protein, "text-protein"], ["жири", n.fat, "text-ink"], ["вугл.", n.carbs, "text-ink"]].map(([l, v, c]) => (
            <div key={l as string} className="rounded-md border border-line py-2">
              <div className={`text-lg font-bold tabular-nums ${c}`}>{v}</div>
              <div className="text-[10px] text-mute">{l}{l !== "ккал" ? ", г" : ""}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-mute">Вода: {n.waterMl} мл · {plan.weeklyRateNote}</div>
        <details className="text-[11px] text-mute"><summary className="cursor-pointer">як пораховано</summary><div className="mt-1">{n.rationale}</div></details>
        <button className={`btn w-full text-xs ${applied ? "text-xp" : "btn-primary"}`} onClick={applyPlanNutrition}>
          {applied ? "✓ Цілі «Палива» оновлено" : "ЗАСТОСУВАТИ ДО «ПАЛИВА»"}
        </button>
      </Card>

      <div className="flex items-center justify-between">
        <Label>Тренування · {plan.days.length} на тиждень</Label>
        <button className="text-[11px] text-mute underline" onClick={onEdit}>змінити анкету</button>
      </div>

      {plan.days.map((d, i) => (
        <Card key={i} className={i === next ? "border-xp/50" : ""}>
          <button className="w-full text-left" onClick={() => setOpen(open === i ? null : i)}>
            <div className="flex items-baseline justify-between gap-2">
              <b className="text-sm">{d.name}</b>
              {i === next && <span className="text-[10px] text-xp">наступне</span>}
            </div>
            <div className="text-[11px] text-mute">{d.focus} · {d.exercises.length} вправ</div>
          </button>
          {open === i && (
            <ul className="mt-2 divide-y divide-line text-xs">
              {d.exercises.map((e, j) => (
                <li key={j} className="py-1.5">
                  <div className="flex justify-between gap-2"><span>{e.name}</span><span className="shrink-0 text-mute">{e.sets}×{e.reps}</span></div>
                  <div className="text-[10px] text-mute">RIR {e.rir} · відпочинок {Math.round(e.restSec / 60 * 10) / 10} хв{e.notes ? ` · ${e.notes}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
          <button className={`btn mt-2 w-full ${i === next ? "btn-primary" : ""}`} onClick={() => startWorkout(i)}>▶ ПОЧАТИ</button>
        </Card>
      ))}

      <Card className="space-y-2 text-xs">
        <button className="w-full text-left" onClick={() => setMore(!more)}>
          <Label>{more ? "▾" : "▸"} Принципи, прогресія, джерела</Label>
        </button>
        {more && (
          <>
            <ul className="list-disc pl-4 space-y-1">{plan.principles.map((p, i) => <li key={i}>{p}</li>)}</ul>
            <div><b>Прогресія:</b> {plan.progression}</div>
            <div><b>Розвантаження:</b> {plan.deload}</div>
            <div className="text-mute">
              <b>Джерела:</b>
              <ul className="list-disc pl-4">{plan.references.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          </>
        )}
      </Card>

      {training.logs.length > 0 && (
        <Card>
          <Label>Історія</Label>
          <ul className="mt-2 divide-y divide-line text-xs">
            {training.logs.slice(0, 15).map((l) => {
              const top = l.exercises
                .map((e) => ({ name: e.name, best: Math.max(...e.sets.map((s) => e1rm(s.weight, s.reps))) }))
                .sort((a, b) => b.best - a.best)[0];
              return (
                <li key={l.id} className="flex items-center gap-2 py-1.5">
                  <span className="text-mute w-12">{l.date.slice(5)}</span>
                  <span className="flex-1 truncate">{l.dayName}{top?.best ? ` · ${top.name} ≈1ПМ ${top.best} кг` : ""}</span>
                  <span className="text-[#fb923c]">+{l.xp}</span>
                  <button className="text-mute" onClick={() => confirm("Видалити запис?") && deleteWorkoutLog(l.id)}>✕</button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function TrainingScreen() {
  const training = useGame((s) => s.training);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<WorkoutLog | null>(null);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-lg font-bold">Силові тренування</div>
        <div className="text-xs text-mute">План від ШІ на основі досліджень · кожне тренування качає Силу</div>
      </div>
      {result && !training.active && (
        <Card className="space-y-1 text-center border-xp/50">
          <div className="text-2xl">💪</div>
          <b>Тренування завершено</b>
          <div className="text-sm">+{result.xp} XP → Сила · {result.minutes} хв · {Math.round(volume(result))} кг тоннажу</div>
          <button className="text-[11px] text-mute underline" onClick={() => setResult(null)}>закрити</button>
        </Card>
      )}
      {training.active && training.plan ? (
        <WorkoutMode onFinished={setResult} />
      ) : !training.plan || editing ? (
        <Questionnaire onDone={() => setEditing(false)} onCancel={training.plan ? () => setEditing(false) : undefined} />
      ) : (
        <PlanView onEdit={() => setEditing(true)} />
      )}
    </div>
  );
}
