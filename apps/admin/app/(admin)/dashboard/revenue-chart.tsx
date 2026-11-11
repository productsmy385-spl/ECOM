"use client";

import { formatPaise } from "@ecom/ui/format";
import { useState } from "react";

type Point = { day: string; revenue: number; orders: number };

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

function niceMax(v: number) {
  if (v <= 0) return 100_000; // ₹1,000 so an empty chart still has a scale
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Paid revenue per day, last 30 days. One series in the brand colour (validated
 * for both themes), thin bars with rounded tops anchored to the baseline,
 * recessive grid, a per-bar hover tooltip, and a table for screen readers.
 */
export function RevenueChart({ series }: { series: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...series.map((s) => s.revenue)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / series.length;
  const bw = Math.max(4, slot - 2); // 2px surface gap between bars
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const h = hover !== null ? series[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Paid revenue per day for the last 30 days" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {formatPaise(t, { whole: true })}
            </text>
          </g>
        ))}
        {series.map((s, i) => {
          const x = PAD.left + i * slot + (slot - bw) / 2;
          const top = y(s.revenue);
          const height = PAD.top + ih - top;
          return (
            <g key={s.day}>
              {/* Hit target: the whole column, larger than the bar. */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
              {s.revenue > 0 && (
                <path
                  d={`M${x},${PAD.top + ih} V${top + Math.min(4, height)} Q${x},${top} ${x + Math.min(4, bw / 2)},${top} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${top} ${x + bw},${top + Math.min(4, height)} V${PAD.top + ih} Z`}
                  className={hover === i ? "fill-[#a80c3a] dark:fill-[#ff6f93]" : "fill-[#CF0F47] dark:fill-[#F23A6C]"}
                  pointerEvents="none"
                />
              )}
              {i % 5 === 0 && (
                <text x={PAD.left + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {dayLabel(s.day)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + ih} y2={PAD.top + ih} className="stroke-foreground/30" strokeWidth={1} />
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-dropdown"
          style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%` }}
        >
          <p className="font-medium">{dayLabel(h.day)}</p>
          <p className="tabular-nums">{formatPaise(h.revenue)}</p>
          <p className="text-muted-foreground">
            {h.orders} paid order{h.orders === 1 ? "" : "s"}
          </p>
        </div>
      )}
      <table className="sr-only">
        <caption>Paid revenue per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Revenue</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.day}>
              <td>{s.day}</td>
              <td>{formatPaise(s.revenue)}</td>
              <td>{s.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
