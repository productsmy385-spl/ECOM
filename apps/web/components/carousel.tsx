"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Slides visible per container width (px). 2 on phones, then 3 / 4 / 5 as the screen widens. */
type Breakpoints = Record<number, number>;
const DEFAULT_BP: Breakpoints = { 0: 2, 760: 3, 1000: 4, 1400: 5 };

/**
 * Lightweight slider: 500 ms sliding transitions, round arrow buttons on the
 * sides (greyed out at the ends), touch/mouse swipe and keyboard arrows.
 */
export function Carousel({
  children,
  label,
  breakpoints = DEFAULT_BP,
  gap = 20,
  arrows = "sides",
  className,
  loop = false,
  autoplayMs,
}: {
  children: React.ReactNode;
  label: string;
  breakpoints?: Breakpoints;
  gap?: number;
  arrows?: "sides" | "none";
  className?: string;
  loop?: boolean;
  autoplayMs?: number;
}) {
  const slides = Children.toArray(children);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<{ x: number; dx: number } | null>(null);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const perView = Object.entries(breakpoints)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0])
    .reduce((n, [min, v]) => (width >= min ? v : n), 1);
  const maxIndex = Math.max(0, slides.length - perView);
  const current = Math.min(index, maxIndex);
  const slideW = width ? (width - gap * (perView - 1)) / perView : 0;

  const go = useCallback(
    (to: number) => setIndex(loop ? (to > maxIndex ? 0 : to < 0 ? maxIndex : to) : Math.max(0, Math.min(maxIndex, to))),
    [loop, maxIndex],
  );

  useEffect(() => {
    if (!autoplayMs || drag || maxIndex === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setIndex((i) => (i >= maxIndex ? 0 : i + 1)), autoplayMs);
    return () => clearInterval(t);
  }, [autoplayMs, drag, maxIndex]);

  const offset = -(current * (slideW + gap)) + (drag?.dx ?? 0);
  const atStart = !loop && current === 0;
  const atEnd = !loop && current >= maxIndex;
  const btn = "absolute top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-foreground shadow-card transition-colors duration-300 hover:border-primary hover:text-primary disabled:pointer-events-none disabled:text-border sm:flex";

  return (
    <div
      className={cn("relative", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(current + 1);
        if (e.key === "ArrowLeft") go(current - 1);
      }}
    >
      <div
        ref={viewport}
        className="touch-pan-y overflow-hidden"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          setDrag({ x: e.clientX, dx: 0 });
        }}
        onPointerMove={(e) => drag && setDrag({ x: drag.x, dx: e.clientX - drag.x })}
        onPointerUp={() => {
          if (drag && Math.abs(drag.dx) > 40) go(current + (drag.dx < 0 ? 1 : -1));
          setDrag(null);
        }}
        onPointerLeave={() => drag && setDrag(null)}
        onClickCapture={(e) => {
          // A swipe must not also open the product under the pointer.
          if (drag && Math.abs(drag.dx) > 5) e.preventDefault();
        }}
      >
        <ul
          className="flex"
          style={{
            gap,
            transform: `translate3d(${offset}px,0,0)`,
            transition: drag ? "none" : "transform 500ms ease",
          }}
        >
          {slides.map((s, i) => (
            <li
              key={i}
              className="shrink-0"
              style={{ width: slideW || `${100 / perView}%` }}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
              aria-hidden={i < current || i >= current + perView ? true : undefined}
              inert={i < current || i >= current + perView ? true : undefined}
            >
              {s}
            </li>
          ))}
        </ul>
      </div>

      {arrows === "sides" && maxIndex > 0 && (
        <>
          <button type="button" onClick={() => go(current - 1)} disabled={atStart} aria-label="Previous" className={cn(btn, "-left-3 h-12 w-12 xl:-left-16 xl:h-14 xl:w-14")}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => go(current + 1)} disabled={atEnd} aria-label="Next" className={cn(btn, "-right-3 h-12 w-12 xl:-right-16 xl:h-14 xl:w-14")}>
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {maxIndex > 0 && (
        <div className="mt-5 flex justify-center gap-2 sm:hidden" aria-hidden="true">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <span key={i} className={cn("h-2 rounded-full transition-all duration-300", i === current ? "w-6 bg-primary" : "w-2 bg-border")} />
          ))}
        </div>
      )}
    </div>
  );
}
