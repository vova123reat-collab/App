"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Point } from "@/lib/training";

export interface Series {
  name: string;
  points: Point[];
  color: string;
  kind: "line" | "dots";
}

const dayNum = (iso: string) => Date.parse(iso + "T12:00:00Z") / 86_400_000;
const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** «Гарні» межі осі Y з кроком 1/2/2.5/5 × 10ⁿ. */
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * Лінійний графік за часом: одна вісь Y, тонкі лінії 2px, маркери ≥8px,
 * перехрестя + підказка під пальцем/курсором, підпис останнього значення.
 * primary — серія, по якій шукається найближча точка для підказки.
 */
export function LineChart({
  series, unit, height = 190, primary = 0, ariaLabel,
}: { series: Series[]; unit: string; height?: number; primary?: number; ariaLabel: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.points);
  const pad = { l: 36, r: 46, t: 12, b: 24 };
  const geo = useMemo(() => {
    const xs = all.map((p) => dayNum(p.date));
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const ticks = niceTicks(Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y)));
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const sx = (d: string) => pad.l + (x1 === x0 ? (w - pad.l - pad.r) / 2 : ((dayNum(d) - x0) / (x1 - x0)) * (w - pad.l - pad.r));
    const sy = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (height - pad.t - pad.b);
    return { sx, sy, ticks, x0, x1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(all), w, height]);

  if (!all.length) return null;
  const main = series[primary];
  const hp = hover !== null ? main.points[hover] : null;

  const onMove = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const x = clientX - r.left;
    let best = 0, bd = Infinity;
    main.points.forEach((p, i) => { const d = Math.abs(geo.sx(p.date) - x); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  const last = main.points[main.points.length - 1];
  const xLabels = [main.points[0]?.date, main.points.length > 2 ? main.points[Math.floor(main.points.length / 2)].date : null, last?.date]
    .filter((d, i, a): d is string => !!d && a.indexOf(d) === i);

  return (
    <div ref={wrap} className="relative select-none touch-none"
      onPointerMove={(e) => onMove(e.clientX)} onPointerDown={(e) => onMove(e.clientX)} onPointerLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label={ariaLabel} className="block">
        {/* сітка й підписи осі Y — приглушені */}
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={geo.sy(t)} y2={geo.sy(t)} stroke="#222" strokeWidth={1} />
            <text x={pad.l - 6} y={geo.sy(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#6b6b6b">{t}</text>
          </g>
        ))}
        {xLabels.map((d) => (
          <text key={d} x={geo.sx(d)} y={height - 6} textAnchor="middle" fontSize={10} fill="#6b6b6b">{ddmm(d)}</text>
        ))}

        {series.map((s) => s.kind === "line" ? (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
            points={s.points.map((p) => `${geo.sx(p.date)},${geo.sy(p.y)}`).join(" ")} />
        ) : (
          <g key={s.name}>
            {s.points.map((p) => (
              <circle key={p.date} cx={geo.sx(p.date)} cy={geo.sy(p.y)} r={3} fill={s.color} opacity={0.55} />
            ))}
          </g>
        ))}

        {/* маркери основної серії з кільцем кольору поверхні */}
        {main.kind === "line" && main.points.map((p, i) => (
          <circle key={p.date} cx={geo.sx(p.date)} cy={geo.sy(p.y)} r={i === main.points.length - 1 || i === hover ? 4.5 : 3}
            fill={main.color} stroke="#0f0f0f" strokeWidth={2} />
        ))}

        {/* підпис останнього значення */}
        {last && (
          <text x={geo.sx(last.date) + 8} y={geo.sy(last.y)} dominantBaseline="middle" fontSize={11} fill="#ececec" fontWeight={700}>
            {last.y}
          </text>
        )}

        {hp && <line x1={geo.sx(hp.date)} x2={geo.sx(hp.date)} y1={pad.t} y2={height - pad.b} stroke="#555" strokeWidth={1} strokeDasharray="3 3" />}
      </svg>

      {hp && (
        <div className="pointer-events-none absolute top-1 rounded-md border border-line bg-[#141414] px-2 py-1 text-[11px] shadow-lg"
          style={{ left: Math.min(Math.max(geo.sx(hp.date) - 60, 0), w - 130), minWidth: 120 }}>
          <div className="text-mute">{ddmm(hp.date)}</div>
          {series.map((s) => {
            const p = s.points.find((q) => q.date === hp.date);
            return p ? (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
                <span className="text-mute">{s.name}</span>
                <b className="ml-auto tabular-nums">{p.y} {unit}</b>
              </div>
            ) : null;
          })}
          {hp.label && <div className="text-mute">{hp.label}</div>}
        </div>
      )}
    </div>
  );
}
