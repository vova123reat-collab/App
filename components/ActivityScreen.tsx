"use client";
import { useState } from "react";
import { Card, Label } from "./ui";
import { isBuffed, todayLog, useGame } from "@/lib/store";
import { Activity, ACTIVITIES, ATTR_KEYS, ATTRS, BUFF_MULT } from "@/lib/game";

function ActivityRow({ a, onLog }: { a: Activity; onLog: (n: number) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">{a.name}</div>
        <div className="text-[10px] text-mute shrink-0">
          {a.kind === "once" ? `+${a.xpPerUnit} XP` : `${a.xpPerUnit} XP/хв`}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {a.kind === "once" ? (
          <button className="btn !py-1 text-xs" onClick={() => onLog(1)}>✓ Зроблено</button>
        ) : (
          <>
            {a.presets?.map((p) => (
              <button key={p} className="btn !py-1 text-xs" onClick={() => onLog(p)}>{p} хв</button>
            ))}
            <input inputMode="numeric" placeholder="хв" value={custom} className="!w-16 !py-1 text-xs"
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} />
            <button className="btn !py-1 text-xs" onClick={() => { const n = Number(custom); if (n > 0) { onLog(n); setCustom(""); } }}>+</button>
          </>
        )}
      </div>
    </div>
  );
}

export function ActivityScreen() {
  const s = useGame();
  const log = todayLog(s);
  const entries = [...(log.activities ?? [])].reverse();
  const [toast, setToast] = useState<string | null>(null);
  const buffed = isBuffed(s);

  const logIt = (a: Activity, n: number) => {
    const e = s.logActivity(a, n);
    setToast(`+${e.xp} XP → ${ATTRS[a.attr].name}`);
    setTimeout(() => setToast(null), 2000);
  };

  const todayXp = Object.fromEntries(ATTR_KEYS.map((k) => [k, entries.filter((e) => e.attr === k).reduce((a, e) => a + e.xp, 0)]));

  return (
    <div className="space-y-3">
      <div>
        <div className="text-lg font-bold">Активність</div>
        <div className="text-xs text-mute">
          Швидкий лог дій — кожна качає свою характеристику{buffed ? ` · баф x${BUFF_MULT} активний` : ""}.
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {ATTR_KEYS.map((k) => (
          <Card key={k} className="!p-2 text-center">
            <div className="text-[10px]" style={{ color: ATTRS[k].color }}>{ATTRS[k].short}</div>
            <div className="text-lg font-bold tabular-nums">{s.xp[k]}</div>
            <div className="text-[10px] text-mute">+{todayXp[k]} сьогодні</div>
          </Card>
        ))}
      </div>

      {toast && <div className="text-xs text-buff">{toast}</div>}

      {ATTR_KEYS.map((k) => (
        <Card key={k}>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: ATTRS[k].color }} />
            <b className="text-sm">{ATTRS[k].name}</b>
          </div>
          <div className="divide-y divide-line">
            {ACTIVITIES.filter((a) => a.attr === k).map((a) => (
              <ActivityRow key={a.id} a={a} onLog={(n) => logIt(a, n)} />
            ))}
          </div>
        </Card>
      ))}

      {entries.length > 0 && (
        <Card>
          <Label>Сьогодні</Label>
          <ul className="mt-2 divide-y divide-line text-xs">
            {entries.map((e) => {
              const a = ACTIVITIES.find((x) => x.id === e.activityId);
              return (
                <li key={e.id} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1">{a?.name ?? "?"}{a?.kind === "minutes" ? ` · ${e.amount} хв` : ""}</span>
                  <span style={{ color: ATTRS[e.attr].color }}>+{e.xp}</span>
                  <button className="text-mute" onClick={() => s.removeActivity(e.id)} aria-label="Скасувати">✕</button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
