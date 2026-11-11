"use client";

import { useEffect, useState } from "react";

const parts = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hrs: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), sec: s % 60 };
};

/** Live countdown to a real offer end date (never a made-up deadline). */
export function Countdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <div className="my-4 h-[4.25rem]" aria-hidden="true" />;
  const p = parts(end - now);
  const cell = (v: number, label: string, pad = true) => (
    <div className="grid text-center">
      <span className="font-display text-4xl font-light tabular-nums sm:text-5xl">{pad ? String(v).padStart(2, "0") : v}</span>
      <small className="text-sm">{label}</small>
    </div>
  );
  return (
    <div className="my-4 flex items-start gap-3 sm:gap-4" role="timer" aria-label={`Offer ends in ${p.days} days ${p.hrs} hours ${p.min} minutes`}>
      {cell(p.days, "Days", false)}
      <span className="font-display text-4xl text-primary sm:text-5xl">:</span>
      {cell(p.hrs, "Hrs")}
      <span className="font-display text-4xl text-primary sm:text-5xl">:</span>
      {cell(p.min, "Min")}
      <span className="font-display text-4xl text-primary sm:text-5xl">:</span>
      {cell(p.sec, "Sec")}
    </div>
  );
}
