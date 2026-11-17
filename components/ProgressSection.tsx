"use client";
import { useMemo, useState } from "react";
import { Card, Label } from "./ui";
import { LineChart } from "./LineChart";
import { useGame } from "@/lib/store";
import { exerciseSeries, Point, trackedExercises, weeklyRate, weightTrend } from "@/lib/training";

const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const WEIGHT = "#38bdf8";
const STRENGTH = "#4ade80";

function TableToggle({ rows, onDelete }: { rows: { date: string; text: string }[]; onDelete?: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="text-[11px] text-mute" onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} таблиця ({rows.length})</button>
      {open && (
        <ul className="mt-1 max-h-48 overflow-y-auto divide-y divide-line text-xs">
          {[...rows].reverse().map((r) => (
            <li key={r.date} className="flex items-center gap-2 py-1">
              <span className="w-12 text-mute">{ddmm(r.date)}</span>
              <span className="flex-1 tabular-nums">{r.text}</span>
              {onDelete && <button className="text-mute" onClick={() => onDelete(r.date)} aria-label="Видалити">✕</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BodyWeightCard() {
  const { training, profile, logBodyWeight, removeBodyWeight } = useGame();
  const [kg, setKg] = useState("");
  const points: Point[] = useMemo(
    () => Object.entries(training.bodyWeights ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([date, y]) => ({ date, y })),
    [training.bodyWeights],
  );
  const trend = useMemo(() => weightTrend(points), [points]);
  const rate = weeklyRate(trend);
  const cur = trend[trend.length - 1]?.y;
  const pct = rate !== null && cur ? Math.round((rate / cur) * 1000) / 10 : null;
  const goal = training.answers?.goal;
  const want = goal === "cut" || goal === "lean" ? "down" : goal === "bulk" ? "up" : "flat";
  const onTrack = rate === null ? null
    : want === "down" ? rate < -0.1 && pct! >= -1.2
    : want === "up" ? rate > 0.05 && pct! <= 0.6
    : Math.abs(rate) <= 0.25;

  const save = () => {
    const v = Number(kg.replace(",", "."));
    if (v >= 30 && v <= 300) { logBodyWeight(v); setKg(""); }
  };

  return (
    <Card className="space-y-2">
      <div className="flex items-baseline justify-between">
        <b className="text-sm">Вага тіла</b>
        {cur && <span className="text-xs text-mute">тренд {cur} кг</span>}
      </div>

      <div className="flex gap-2">
        <input inputMode="decimal" placeholder={`сьогодні, кг (${profile.weightKg})`} value={kg}
          onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} className="text-sm" />
        <button className="btn btn-primary shrink-0" onClick={save}>Записати</button>
      </div>

      {points.length >= 2 ? (
        <>
          <div className="flex gap-3 text-[11px] text-mute">
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full opacity-60" style={{ background: WEIGHT }} />зважування</span>
            <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3" style={{ background: WEIGHT }} />тренд 7 днів</span>
          </div>
          <LineChart unit="кг" primary={1} ariaLabel="Графік ваги тіла"
            series={[
              { name: "зважування", points, color: WEIGHT, kind: "dots" },
              { name: "тренд", points: trend, color: WEIGHT, kind: "line" },
            ]} />
          {rate !== null && (
            <div className="text-xs">
              Темп: <b className="tabular-nums">{rate > 0 ? "+" : ""}{rate} кг/тиждень</b>
              <span className="text-mute"> ({pct! > 0 ? "+" : ""}{pct}% маси)</span>
              {onTrack !== null && goal && (
                <span className={onTrack ? "text-xp" : "text-buff"}>
                  {" "}· {onTrack ? "✓ по плану" : want === "down" ? (rate >= -0.1 ? "⚠ вага стоїть — мінус 100–200 ккал" : "⚠ надто швидко — додай 100–200 ккал") : want === "up" ? (rate <= 0.05 ? "⚠ вага не росте — плюс 100–200 ккал" : "⚠ надто швидко — мінус 100 ккал") : "⚠ вага змінюється"}
                </span>
              )}
            </div>
          )}
          <TableToggle rows={points.map((p) => ({ date: p.date, text: `${p.y} кг` }))} onDelete={removeBodyWeight} />
        </>
      ) : (
        <div className="text-[11px] text-mute">
          Зважуйся вранці натще, після туалету. Графік з'явиться після 2 записів, темп — після тижня.
          {points.length === 1 && ` Записано: ${points[0].y} кг (${ddmm(points[0].date)}).`}
        </div>
      )}
    </Card>
  );
}

function StrengthCard() {
  const logs = useGame((s) => s.training.logs);
  const names = useMemo(() => trackedExercises(logs), [logs]);
  const [sel, setSel] = useState<string | null>(null);
  const ex = sel && names.includes(sel) ? sel : names[0];
  const pts = useMemo(() => (ex ? exerciseSeries(logs, ex) : []), [logs, ex]);

  if (!names.length) {
    return (
      <Card>
        <b className="text-sm">Сила у вправах</b>
        <div className="mt-1 text-[11px] text-mute">Заверши тренування з вагою — тут з'явиться графік прогресу по кожній вправі.</div>
      </Card>
    );
  }

  const first = pts[0], last = pts[pts.length - 1];
  const gain = first && last && first.y ? Math.round(((last.y - first.y) / first.y) * 1000) / 10 : 0;
  const pr = pts.reduce((a, p) => (p.y > a.y ? p : a), pts[0]);

  return (
    <Card className="space-y-2">
      <div className="flex items-baseline justify-between">
        <b className="text-sm">Сила у вправах</b>
        <span className="text-[11px] text-mute">оцінка 1ПМ (Еплі)</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
        {names.map((n) => (
          <button key={n} onClick={() => setSel(n)}
            className={`shrink-0 rounded-full border px-2.5 py-1 ${n === ex ? "border-ink text-ink" : "border-line text-mute"}`}>{n}</button>
        ))}
      </div>
      {pts.length >= 2 ? (
        <LineChart unit="кг" ariaLabel={`Прогрес: ${ex}`} series={[{ name: "1ПМ", points: pts, color: STRENGTH, kind: "line" }]} />
      ) : (
        <div className="text-[11px] text-mute">Ще одне тренування з цією вправою — і буде лінія.</div>
      )}
      {pts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-line py-1.5">
            <div className="text-sm font-bold tabular-nums">{last.y}</div><div className="text-[10px] text-mute">зараз, кг</div>
          </div>
          <div className="rounded-md border border-line py-1.5">
            <div className="text-sm font-bold tabular-nums">{pr.y}</div><div className="text-[10px] text-mute">рекорд · {ddmm(pr.date)}</div>
          </div>
          <div className="rounded-md border border-line py-1.5">
            <div className={`text-sm font-bold tabular-nums ${gain > 0 ? "text-xp" : ""}`}>{gain > 0 ? "+" : ""}{gain}%</div><div className="text-[10px] text-mute">від старту</div>
          </div>
        </div>
      )}
      <TableToggle rows={pts.map((p) => ({ date: p.date, text: `≈${p.y} кг · ${p.label ?? ""}` }))} />
    </Card>
  );
}

export function ProgressSection() {
  return (
    <div className="space-y-3">
      <Label>Прогрес</Label>
      <BodyWeightCard />
      <StrengthCard />
    </div>
  );
}
