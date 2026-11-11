"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface AreaSeries {
  key: string;
  label: string;
  /** CSS colour, e.g. "var(--chart-1)". */
  color: string;
}

interface Props<T extends Record<string, unknown>> {
  data: T[];
  xKey: keyof T & string;
  series: AreaSeries[];
  height?: number;
  formatX?: (v: T[keyof T]) => string;
  formatY?: (v: number) => string;
  /** Show every nth x label (auto when omitted). */
  xEvery?: number;
  ariaLabel: string;
  /** Whole-number axis steps (counts). */
  integer?: boolean;
}

const PAD = { top: 10, right: 12, bottom: 28, left: 56 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Smooth monotone-ish path through points (Catmull-Rom → cubic Bézier, y clamped). */
function smooth(pts: [number, number][], minY: number, maxY: number) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0]![0]},${pts[0]![1]}`;
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  const clamp = (y: number) => Math.min(maxY, Math.max(minY, y));
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) * t, clamp(p1[1] + (p2[1] - p0[1]) * t)];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) * t, clamp(p2[1] - (p3[1] - p1[1]) * t)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * DropX analytics area chart, dependency-free: soft gradient fill under a 2px
 * line, dashed horizontal grid, muted 11px axis labels without axis lines,
 * a vertical hover cursor with a card tooltip, and a screen-reader table.
 */
export function AreaChart<T extends Record<string, unknown>>({ data, xKey, series, height = 280, formatX = (v) => String(v), formatY = (v) => String(v), xEvery, ariaLabel, integer = false }: Props<T>) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const iw = width - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  // Four equal, round steps (e.g. 0 · 2K · 4K · 6K · 8K).
  const rawStep = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))) / 4);
  const max = (integer ? Math.max(1, Math.ceil(rawStep)) : rawStep) * 4;
  const x = (i: number) => PAD.left + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = xEvery ?? Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 70))));
  const base = PAD.top + ih;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - PAD.left) / Math.max(1, iw)) * (data.length - 1));
    setHover(i >= 0 && i < data.length ? i : null);
  }

  const h = hover !== null ? data[hover] : null;

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block">
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.22} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeDasharray="3 3" />
            <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-muted-foreground">
              {formatY(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} className="fill-muted-foreground">
              {formatX(d[xKey])}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const pts = data.map((d, i) => [x(i), y(Number(d[s.key]) || 0)] as [number, number]);
          const line = smooth(pts, PAD.top, base);
          return (
            <g key={s.key}>
              {pts.length > 1 && <path d={`${line} L${pts[pts.length - 1]![0]},${base} L${pts[0]![0]},${base} Z`} fill={`url(#${gid}-${s.key})`} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && h && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={base} className="stroke-border" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(Number(h[s.key]) || 0)} r={4} fill="var(--card)" stroke={s.color} strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && h && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-border bg-card px-2.5 py-2 text-xs shadow-dropdown"
          style={{ left: Math.min(Math.max(x(hover) + 12, 0), width - 160) }}
        >
          <p className="mb-0.5 font-semibold text-foreground">{formatX(h[xKey])}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center gap-1.5 tabular-nums">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}:</span> {formatY(Number(h[s.key]) || 0)}
            </p>
          ))}
        </div>
      )}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>{xKey}</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <td>{formatX(d[xKey])}</td>
              {series.map((s) => (
                <td key={s.key}>{formatY(Number(d[s.key]) || 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
