"use client";
import { useState } from "react";
import { Bar, Card, Label } from "./ui";
import { useGame } from "@/lib/store";
import { Attr, fmtHM, SKILL_TARGET_MIN, skillStageIndex, Stage, STAGE_TEMPLATE, uid } from "@/lib/game";

function SkillBuilder({ onDone }: { onDone: () => void }) {
  const addSkill = useGame((s) => s.addSkill);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [attr, setAttr] = useState<Attr>("int");
  const [drafts, setDrafts] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!name.trim()) return setError("Вкажи назву навички");
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/deconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: name, context }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Помилка");
      setAttr(j.attr);
      setDrafts(j.stages.map((st: { steps: string[] }) => st.steps.join("\n")));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!name.trim()) return setError("Вкажи назву навички");
    const stages: Stage[] = STAGE_TEMPLATE.map((t, i) => ({
      ...t,
      steps: drafts[i].split("\n").map((x) => x.trim()).filter(Boolean)
        .map((text) => ({ id: uid(), text, done: false })),
    }));
    addSkill(name.trim(), attr, stages);
    onDone();
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <b>Нова навичка · деконструкція</b>
        <button className="text-mute text-sm" onClick={onDone}>✕</button>
      </div>
      <input placeholder="напр. Кольорокорекція в DaVinci Resolve" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea
        rows={2}
        placeholder="контекст для ШІ (необов'язково): рівень, обладнання, мета"
        value={context}
        onChange={(e) => setContext(e.target.value)}
        className="text-sm"
      />
      <div className="flex gap-2">
        <select value={attr} onChange={(e) => setAttr(e.target.value as Attr)} className="!w-auto text-sm">
          <option value="int">Інтелект</option>
          <option value="str">Сила</option>
        </select>
        <button className="btn btn-primary flex-1" onClick={generate} disabled={loading}>
          {loading ? "ШІ розбирає…" : "✦ РОЗІБРАТИ З ШІ"}
        </button>
      </div>
      {error && <div className="text-xs text-hp">{error}</div>}

      {STAGE_TEMPLATE.map((t, i) => (
        <div key={i}>
          <Label>Етап {i + 1} · год {t.hours[0]}–{t.hours[1]} · {t.title}</Label>
          <textarea
            rows={3}
            className="mt-1 text-sm"
            placeholder="один крок на рядок"
            value={drafts[i]}
            onChange={(e) => setDrafts(drafts.map((d, j) => (j === i ? e.target.value : d)))}
          />
        </div>
      ))}
      <button className="btn btn-primary w-full" onClick={save}>ЗБЕРЕГТИ НАВИЧКУ</button>
    </Card>
  );
}

export function SkillsScreen() {
  const { skills, timer, startTimer, toggleStep, removeSkill } = useGame();
  const [building, setBuilding] = useState(false);
  const [open, setOpen] = useState<string | null>(skills[0]?.id ?? null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold">Дерево навичок</div>
          <div className="text-xs text-mute">20 годин сфокусованої практики = база будь-чого</div>
        </div>
        {!building && <button className="btn btn-primary" onClick={() => setBuilding(true)}>+ НОВА</button>}
      </div>

      {building && <SkillBuilder onDone={() => setBuilding(false)} />}

      {skills.length === 0 && !building && (
        <Card><div className="text-sm text-mute">Порожньо. Додай навичку — ШІ розіб&apos;є її на 4 етапи.</div></Card>
      )}

      {skills.map((k) => {
        const cur = skillStageIndex(k.minutes);
        const isOpen = open === k.id;
        return (
          <Card key={k.id}>
            <button className="w-full text-left" onClick={() => setOpen(isOpen ? null : k.id)}>
              <div className="flex items-baseline justify-between gap-2">
                <b className="truncate">{k.name}</b>
                <span className={`text-[11px] ${k.attr === "int" ? "text-[#a78bfa]" : "text-[#fb923c]"}`}>
                  {k.attr === "int" ? "INT" : "STR"}
                </span>
              </div>
              <div className="mt-2"><Bar value={k.minutes} max={SKILL_TARGET_MIN} color="linear-gradient(90deg,#16a34a,#4ade80)" /></div>
              <div className="mt-1 flex justify-between text-[11px] text-mute">
                <span>{fmtHM(k.minutes)} / 20г</span>
                <span>{k.minutes >= SKILL_TARGET_MIN ? "🏆 БОС ПЕРЕМОЖЕНИЙ" : `етап ${cur + 1}/4`}</span>
              </div>
            </button>

            {isOpen && (
              <div className="mt-3 space-y-3">
                {k.stages.map((st, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${i === cur ? "border-xp/50" : "border-line"} ${i > cur ? "opacity-60" : ""}`}>
                    <Label>Етап {i + 1} · год {st.hours[0]}–{st.hours[1]} · {st.title}</Label>
                    <ul className="mt-2 space-y-1.5">
                      {st.steps.map((p) => (
                        <li key={p.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={p.done}
                            onChange={() => toggleStep(k.id, p.id)}
                            className="!w-4 !p-0 mt-0.5 accent-[#4ade80]"
                          />
                          <span className={`flex-1 ${p.done ? "line-through text-mute" : ""}`}>{p.text}</span>
                          <button
                            className="text-xs text-xp disabled:opacity-30"
                            disabled={!!timer}
                            onClick={() => startTimer(k.id, p.id)}
                            aria-label="Почати фокус"
                          >
                            ▶
                          </button>
                        </li>
                      ))}
                      {st.steps.length === 0 && <li className="text-xs text-mute">кроків немає</li>}
                    </ul>
                  </div>
                ))}
                <button
                  className="text-xs text-mute underline"
                  onClick={() => confirm(`Видалити «${k.name}»?`) && removeSkill(k.id)}
                >
                  видалити навичку
                </button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
