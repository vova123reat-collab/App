"use client";
import { useEffect, useState } from "react";
import { Bar, Card, Label, Ring } from "./ui";
import { isBuffed, todayLog, useGame } from "@/lib/store";
import {
  BUFF_MULT, fmtClock, HP_MAX, levelInfo, proteinGoal, SKILL_TARGET_MIN, skillStageIndex, waterGoal,
} from "@/lib/game";
import { logSession } from "@/lib/supabase";

export function CharacterCard({ onEdit }: { onEdit: () => void }) {
  const s = useGame();
  const total = s.xp.int + s.xp.str;
  const lv = levelInfo(total);
  const buffed = isBuffed(s);
  const initials = s.profile.name.trim().slice(0, 2).toUpperCase() || "??";

  return (
    <Card>
      <div className="flex items-center gap-3">
        <button
          onClick={onEdit}
          className="size-14 shrink-0 rounded-lg border border-line bg-card-2 grid place-items-center text-lg font-bold"
          aria-label="Профіль"
        >
          {initials}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate text-lg font-bold">{s.profile.name}</div>
            <div className="text-xs text-mute shrink-0">LVL {lv.level}</div>
          </div>
          <Bar value={lv.into} max={lv.need} color="linear-gradient(90deg,#16a34a,#4ade80,#a3e635)" />
          <div className="mt-1 text-right text-[11px] text-mute">{lv.into}/{lv.need} XP</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 text-xs">
        <span className="text-mute">HP</span>
        <Bar value={s.hp} max={HP_MAX} color="linear-gradient(90deg,#991b1b,#ef4444)" />
        <span className="tabular-nums">{s.hp}/{HP_MAX}</span>
        <span className="text-mute">INT</span>
        <Bar value={s.xp.int} max={Math.max(100, total)} color="#a78bfa" segmented={false} height={4} />
        <span className="tabular-nums">{s.xp.int}</span>
        <span className="text-mute">STR</span>
        <Bar value={s.xp.str} max={Math.max(100, total)} color="#fb923c" segmented={false} height={4} />
        <span className="tabular-nums">{s.xp.str}</span>
      </div>

      <div
        className={`mt-3 rounded-md border px-3 py-2 text-center text-xs font-bold tracking-widest ${
          buffed ? "border-buff/50 text-buff bg-buff/5" : "border-line text-mute"
        }`}
      >
        {buffed ? `⚡ ЗАРЯДЖЕНИЙ x${BUFF_MULT} XP` : "БЕЗ БАФУ · закрий норму сьогодні"}
      </div>
    </Card>
  );
}

export function FuelCard() {
  const s = useGame();
  const log = todayLog(s);
  const pg = proteinGoal(s.profile);
  const wg = waterGoal(s.profile);
  const addProtein = useGame((x) => x.addProtein);
  const addWater = useGame((x) => x.addWater);
  const [custom, setCustom] = useState("");
  const fueled = log.protein >= pg && log.water >= wg;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="text-base font-bold">Паливо</div>
        {fueled && <span className="text-[11px] text-xp">✓ норма → баф завтра</span>}
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Ring value={log.protein} max={pg} label={`${log.protein}/${pg}g`} />
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex justify-between text-sm"><b>БІЛОК</b><span className="text-mute text-xs">{log.protein}/{pg}g</span></div>
            <Bar value={log.protein} max={pg} color="linear-gradient(90deg,#b91c1c,#ef4444)" />
          </div>
          <div>
            <div className="flex justify-between text-sm"><b>ВОДА</b><span className="text-mute text-xs">{log.water}/{wg}ml</span></div>
            <Bar value={log.water} max={wg} color="linear-gradient(90deg,#0369a1,#38bdf8)" />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button className="btn" onClick={() => addProtein(15)}>+15g<div className="text-[10px] text-mute">яйця/сир</div></button>
        <button className="btn" onClick={() => addProtein(25)}>+25g<div className="text-[10px] text-mute">м&apos;ясо/риба</div></button>
        <button className="btn" onClick={() => addProtein(15)}>+15g<div className="text-[10px] text-mute">бобові/горіхи</div></button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          inputMode="numeric"
          placeholder="своя цифра, г"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d-]/g, ""))}
          className="!py-1.5 text-sm"
        />
        <button
          className="btn shrink-0"
          onClick={() => { const n = parseInt(custom, 10); if (n) addProtein(n); setCustom(""); }}
        >
          +g
        </button>
        <button className="btn shrink-0 text-water" onClick={() => addWater(250)}>+250ml</button>
        <button className="btn shrink-0 text-mute" onClick={() => addWater(-250)} aria-label="Відняти воду">−</button>
      </div>
    </Card>
  );
}

/** Активна навичка + таймер фокусу (відлік від 20 годин). */
export function FocusCard({ onOpenSkills }: { onOpenSkills: () => void }) {
  const s = useGame();
  const { timer, startTimer, stopTimer, cancelTimer } = s;
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timer]);

  const skill = s.skills.find((k) => k.id === timer?.skillId) ?? s.skills[0];
  if (!skill) {
    return (
      <Card>
        <Label>Навичка</Label>
        <div className="mt-2 text-sm text-mute">Ще немає навичок. Додай першу — і почни 20 годин.</div>
        <button className="btn btn-primary mt-3 w-full" onClick={onOpenSkills}>+ ДОДАТИ НАВИЧКУ</button>
      </Card>
    );
  }

  const running = timer?.skillId === skill.id;
  const elapsed = running ? now - timer!.startedAt : 0;
  const remainingMs = Math.max(0, SKILL_TARGET_MIN * 60000 - skill.minutes * 60000 - elapsed);
  const stage = skill.stages[skillStageIndex(skill.minutes)];
  const nextStep = stage?.steps.find((p) => !p.done) ?? null;
  const activeStep = running && timer!.stepId
    ? skill.stages.flatMap((st) => st.steps).find((p) => p.id === timer!.stepId)
    : nextStep;

  const stop = () => {
    const sess = stopTimer();
    if (sess) {
      logSession(sess, skill.name);
      setToast(`+${sess.xp} XP · ${sess.minutes} хв`);
    } else setToast("Менше хвилини — не зараховано");
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <Card>
      <div className="text-sm">
        <b>НАВИЧКА:</b> {skill.name}
      </div>
      <div className="text-xs text-mute">(Метод 20 годин · {stage?.title})</div>
      {activeStep && <div className="mt-2 text-xs border-l-2 border-xp pl-2">{activeStep.text}</div>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-3xl font-bold tabular-nums">{fmtClock(remainingMs)}</div>
        {running ? (
          <div className="flex gap-2">
            <button className="btn text-mute" onClick={cancelTimer}>✕</button>
            <button className="btn btn-primary !border-hp/60 text-hp px-5" onClick={stop}>СТОП</button>
          </div>
        ) : (
          <button
            className="btn btn-primary px-6"
            onClick={() => startTimer(skill.id, nextStep?.id ?? null)}
            disabled={!!timer}
          >
            СТАРТ
          </button>
        )}
      </div>
      {running && <div className="mt-1 text-xs text-xp tabular-nums">● сесія {fmtClock(elapsed)}</div>}
      {toast && <div className="mt-2 text-xs text-buff">{toast}</div>}
      <button className="link mt-3 text-xs" onClick={onOpenSkills}>покроковий план від ШІ</button>
    </Card>
  );
}
