"use client";

import { MapPin, Truck } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "adira:pincode";

/** Adds business days (Mon–Sat; Sundays skipped). */
function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left--;
  }
  return d;
}
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

/**
 * Pincode delivery estimate (Flipkart-style). Dates come from the store's
 * shipping settings, plus production time for made-to-order frames.
 */
export function DeliveryCheck({ standardDays, expressDays, productionDays, freeAbove }: { standardDays: [number, number]; expressDays: [number, number]; productionDays: number; freeAbove: string }) {
  const [pin, setPin] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && /^[1-9]\d{5}$/.test(saved)) {
        // Restore after mount (localStorage isn't available during server render).
        requestAnimationFrame(() => {
          setPin(saved);
          setChecked(saved);
        });
      }
    } catch {}
  }, []);

  function check(e: React.FormEvent) {
    e.preventDefault();
    const p = pin.trim();
    if (!/^[1-9]\d{5}$/.test(p)) {
      setError("Enter a valid 6-digit pincode.");
      setChecked(null);
      return;
    }
    setError(null);
    setChecked(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {}
  }

  const now = new Date();
  const std = [addBusinessDays(now, productionDays + standardDays[0]), addBusinessDays(now, productionDays + standardDays[1])];
  const exp = [addBusinessDays(now, productionDays + expressDays[0]), addBusinessDays(now, productionDays + expressDays[1])];

  return (
    <section aria-labelledby="delivery-h" className="mt-6 rounded-xl border border-border p-4">
      <h2 id="delivery-h" className="flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-primary" aria-hidden="true" /> Delivery
      </h2>
      <form onSubmit={check} className="mt-2 flex gap-2">
        <label htmlFor="pincode" className="sr-only">
          Pincode
        </label>
        <input
          id="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter pincode"
          className="w-36 rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
          aria-invalid={!!error}
          aria-describedby="pincode-result"
        />
        <button type="submit" className="rounded-lg px-3 text-sm font-semibold text-link hover:underline">
          Check
        </button>
      </form>
      <div id="pincode-result" aria-live="polite" className="mt-2 text-sm">
        {error && <p className="text-destructive">{error}</p>}
        {checked && !error && (
          <ul className="space-y-1">
            <li className="flex gap-2">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>
                Standard delivery to <strong>{checked}</strong> by <strong>{fmt(std[1]!)}</strong>
                <span className="text-muted-foreground"> (as early as {fmt(std[0]!)})</span>
              </span>
            </li>
            <li className="pl-6 text-muted-foreground">Express: by {fmt(exp[1]!)} · Free delivery above {freeAbove}</li>
            {productionDays > 0 && <li className="pl-6 text-xs text-muted-foreground">Includes {productionDays} days to make your frame.</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
