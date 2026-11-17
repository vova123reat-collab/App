"use client";
import { useState } from "react";
import { Bar, Card } from "./ui";
import { isBuffed, todayLog, useGame } from "@/lib/store";
import { Attr, BUFF_MULT, HP_LOSS_PER_MISSED_QUEST, HP_MAX, QUEST_XP } from "@/lib/game";

export function QuestsScreen() {
  const s = useGame();
  const log = todayLog(s);
  const [title, setTitle] = useState("");
  const [attr, setAttr] = useState<Attr>("str");
  const xp = Math.round(QUEST_XP * (isBuffed(s) ? BUFF_MULT : 1));
  const done = s.quests.filter((q) => log.quests.includes(q.id)).length;

  return (
    <div className="space-y-3">
      <div>
        <div className="text-lg font-bold">Щоденні квести</div>
        <div className="text-xs text-mute">
          Виконав — +{xp} XP і +HP. Пропустив — −{HP_LOSS_PER_MISSED_QUEST} HP вночі.
        </div>
      </div>

      <Card>
        <div className="flex justify-between text-xs text-mute mb-1"><span>HP</span><span>{s.hp}/{HP_MAX}</span></div>
        <Bar value={s.hp} max={HP_MAX} color="linear-gradient(90deg,#991b1b,#ef4444)" />
        <div className="mt-3 flex justify-between text-xs text-mute mb-1"><span>Сьогодні</span><span>{done}/{s.quests.length}</span></div>
        <Bar value={done} max={s.quests.length || 1} color="#4ade80" />
      </Card>

      <Card className="!p-2">
        {s.quests.map((q) => {
          const isDone = log.quests.includes(q.id);
          return (
            <div key={q.id} className="flex items-center gap-3 border-b border-line last:border-0 px-2 py-3">
              <button
                onClick={() => s.toggleQuest(q.id)}
                className={`size-7 shrink-0 rounded-md border grid place-items-center text-sm ${
                  isDone ? "border-xp bg-xp/15 text-xp" : "border-line"
                }`}
                aria-label={isDone ? "Скасувати" : "Виконати"}
              >
                {isDone ? "✓" : ""}
              </button>
              <div className={`flex-1 text-sm ${isDone ? "text-mute line-through" : ""}`}>{q.title}</div>
              <span className="text-[10px] text-mute">{q.attr.toUpperCase()}</span>
              <button className="text-mute text-xs" onClick={() => s.removeQuest(q.id)} aria-label="Видалити">✕</button>
            </div>
          );
        })}
      </Card>

      <Card className="flex gap-2">
        <input placeholder="новий квест" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
        <select value={attr} onChange={(e) => setAttr(e.target.value as Attr)} className="!w-auto text-sm">
          <option value="str">STR</option>
          <option value="int">INT</option>
        </select>
        <button
          className="btn shrink-0"
          onClick={() => { if (title.trim()) { s.addQuest(title.trim(), attr); setTitle(""); } }}
        >
          +
        </button>
      </Card>
    </div>
  );
}
