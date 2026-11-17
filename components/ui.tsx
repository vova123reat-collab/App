"use client";
import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card p-4 ${className}`}>{children}</section>;
}

export function Bar({
  value, max, color, segmented = true, height = 8,
}: { value: number; max: number; color: string; segmented?: boolean; height?: number }) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0)) * 100;
  return (
    <div className="relative w-full rounded-sm bg-[#1d1d1d] overflow-hidden" style={{ height }}>
      <div
        className={`h-full transition-[width] duration-500 ${segmented ? "seg" : ""}`}
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** Сегментоване кільце (червоний → жовтий → зелений), як «85/120g» на референсі. */
export function Ring({ value, max, size = 92, label }: { value: number; max: number; size?: number; label: string }) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const segs = 30;
  const r = size / 2 - 7;
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {Array.from({ length: segs }).map((_, i) => {
        const a0 = (i / segs) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 0.7) / segs) * Math.PI * 2 - Math.PI / 2;
        const on = i / segs < pct;
        const hue = (i / segs) * 120; // 0=red → 120=green
        return (
          <path
            key={i}
            d={`M ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)}`}
            stroke={on ? `hsl(${hue} 75% 52%)` : "#232323"}
            strokeWidth={7}
            fill="none"
          />
        );
      })}
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fill="#ececec" fontSize={size / 7.2} fontFamily="inherit">
        {label}
      </text>
    </svg>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] uppercase tracking-widest text-mute">{children}</div>;
}
