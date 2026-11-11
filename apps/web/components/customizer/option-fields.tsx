"use client";

import { formatPaise } from "@ecom/ui/format";
import type { Prescription, StoredOption } from "@ecom/validation";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadError, uploadDesignImage } from "@/lib/upload-design-image";

type Choice = { value: string; label: string; hex?: string; priceDelta?: number };
const delta = (p?: number) => (p ? `+${formatPaise(p, { whole: true })}` : "");

export function OptionField({
  option,
  value,
  error,
  onChange,
}: {
  option: StoredOption;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const c = option.config as Record<string, unknown> & { choices?: Choice[]; helpText?: string };
  const id = `opt-${option.key}`;
  const legend = (
    <legend className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
      {option.label}
      {option.isRequired && <span className="text-xs font-normal text-primary">Required</span>}
      {option.type === "text" && Number(c.priceDelta) > 0 && <span className="text-xs font-normal text-muted-foreground">{delta(Number(c.priceDelta))}</span>}
    </legend>
  );
  const help = c.helpText ? <p className="mb-2 text-xs text-muted-foreground">{c.helpText}</p> : null;
  const err = error ? <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-destructive">{error}</p> : null;

  switch (option.type) {
    case "color":
      return (
        <fieldset aria-describedby={error ? `${id}-err` : undefined}>
          {legend}{help}
          <div className="flex flex-wrap gap-2">
            {(c.choices ?? []).map((ch) => {
              const on = value === ch.value;
              return (
                <button key={ch.value} type="button" aria-pressed={on} onClick={() => onChange(ch.value)} title={ch.label}
                  className={cn("flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors", on ? "border-primary bg-primary/5" : "border-input hover:border-foreground/40")}>
                  <span className="relative h-7 w-7 rounded-full border border-black/10" style={{ backgroundColor: ch.hex }}>
                    {on && <Check className="absolute inset-0 m-auto h-4 w-4 text-white mix-blend-difference" aria-hidden="true" />}
                  </span>
                  {ch.label}
                  {ch.priceDelta ? <span className="text-xs text-muted-foreground">{delta(ch.priceDelta)}</span> : null}
                </button>
              );
            })}
          </div>
          {err}
        </fieldset>
      );
    case "select":
      return (
        <fieldset aria-describedby={error ? `${id}-err` : undefined}>
          {legend}{help}
          <div className="grid gap-2 sm:grid-cols-2">
            {(c.choices ?? []).map((ch) => {
              const on = value === ch.value;
              return (
                <button key={ch.value} type="button" aria-pressed={on} onClick={() => onChange(ch.value)}
                  className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors", on ? "border-primary bg-primary/5 font-medium" : "border-input hover:border-foreground/40")}>
                  {ch.label}
                  <span className="text-xs text-muted-foreground">{delta(ch.priceDelta)}</span>
                </button>
              );
            })}
          </div>
          {err}
        </fieldset>
      );
    case "multiselect": {
      const picked = Array.isArray(value) ? (value as string[]) : [];
      const max = Number(c.maxSelections ?? 5);
      return (
        <fieldset aria-describedby={error ? `${id}-err` : undefined}>
          {legend}
          <p className="mb-2 text-xs text-muted-foreground">{c.helpText ? `${c.helpText} ` : ""}Choose up to {max}.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(c.choices ?? []).map((ch) => {
              const on = picked.includes(ch.value);
              const disabled = !on && picked.length >= max;
              return (
                <label key={ch.value} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm", on ? "border-primary bg-primary/5" : "border-input", disabled && "cursor-not-allowed opacity-50")}>
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={on} disabled={disabled}
                    onChange={() => onChange(on ? picked.filter((v) => v !== ch.value) : [...picked, ch.value])} />
                  <span className="flex-1">{ch.label}</span>
                  <span className="text-xs text-muted-foreground">{delta(ch.priceDelta)}</span>
                </label>
              );
            })}
          </div>
          {err}
        </fieldset>
      );
    }
    case "text": {
      const s = typeof value === "string" ? value : "";
      const max = Number(c.maxLength ?? 20);
      return (
        <fieldset>
          {legend}{help}
          <input id={id} className={cn("h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-ring", error ? "border-destructive" : "border-input")}
            maxLength={max} placeholder={String(c.placeholder ?? "")} value={s} onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error} aria-describedby={`${id}-count${error ? ` ${id}-err` : ""}`} aria-label={option.label} />
          <p id={`${id}-count`} className="mt-1 text-right text-xs text-muted-foreground">{s.length}/{max}</p>
          {err}
        </fieldset>
      );
    }
    case "number":
      return (
        <fieldset>
          {legend}{help}
          <div className="flex items-center gap-2">
            <input id={id} type="number" className="h-11 w-40 rounded-lg border border-input bg-white px-3 text-sm" min={Number(c.min)} max={Number(c.max)} step={Number(c.step ?? 1)}
              value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} aria-label={option.label} />
            {c.unit ? <span className="text-sm text-muted-foreground">{String(c.unit)}</span> : null}
          </div>
          {err}
        </fieldset>
      );
    case "image":
      return <ImageOption legend={legend} help={help} err={err} value={typeof value === "string" ? value : null} onChange={onChange} priceDelta={Number(c.priceDelta ?? 0)} />;
    case "prescription":
      return (
        <fieldset aria-describedby={error ? `${id}-err` : undefined}>
          {legend}{help}
          <PrescriptionInput value={value as Prescription | undefined} onChange={onChange} />
          {err}
        </fieldset>
      );
    default:
      return null; // canvas is rendered by the canvas editor
  }
}

function ImageOption({ legend, help, err, value, onChange, priceDelta }: { legend: React.ReactNode; help: React.ReactNode; err: React.ReactNode; value: string | null; onChange: (v: unknown) => void; priceDelta: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function pick(f?: File) {
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      onChange((await uploadDesignImage(f)).url);
    } catch (e) {
      setMsg(e instanceof UploadError ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <fieldset>
      {legend}{help}
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- customer's own upload preview
          <img src={value} alt="Your upload" className="h-16 w-16 rounded-lg border border-border object-cover" />
        ) : null}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-sm hover:border-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {value ? "Replace" : "Upload image"} {priceDelta ? <span className="text-xs text-muted-foreground">{delta(priceDelta)}</span> : null}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
            <X className="h-3 w-3" /> Remove
          </button>
        )}
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload image" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {msg && <p role="alert" className="mt-1.5 text-xs text-destructive">{msg}</p>}
      {err}
    </fieldset>
  );
}

const range = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => +(from + i * step).toFixed(2));
const SPH = range(-12, 8, 0.25);
const CYL = range(-6, 0, 0.25);
const ADD = range(0, 3.5, 0.25);
const fmt = (n: number) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

function PrescriptionInput({ value, onChange }: { value?: Prescription; onChange: (v: unknown) => void }) {
  const v: Prescription = value ?? { right: { sph: 0, cyl: 0, axis: 0 }, left: { sph: 0, cyl: 0, axis: 0 }, pd: 62 };
  const set = (p: Partial<Prescription>) => onChange({ ...v, ...p });
  const sel = "h-10 w-full rounded-lg border border-input bg-white px-2 text-sm tabular-nums";
  const eye = (side: "right" | "left", label: string) => (
    <tr>
      <th scope="row" className="py-1 pr-2 text-left text-sm font-medium">{label}</th>
      <td className="p-1"><select aria-label={`${label} SPH`} className={sel} value={v[side].sph} onChange={(e) => set({ [side]: { ...v[side], sph: Number(e.target.value) } })}>{SPH.map((n) => <option key={n} value={n}>{fmt(n)}</option>)}</select></td>
      <td className="p-1"><select aria-label={`${label} CYL`} className={sel} value={v[side].cyl} onChange={(e) => set({ [side]: { ...v[side], cyl: Number(e.target.value) } })}>{CYL.map((n) => <option key={n} value={n}>{fmt(n)}</option>)}</select></td>
      <td className="p-1"><input aria-label={`${label} AXIS`} type="number" min={0} max={180} className={sel} value={v[side].axis} onChange={(e) => set({ [side]: { ...v[side], axis: Math.max(0, Math.min(180, Math.round(Number(e.target.value) || 0))) } })} /></td>
    </tr>
  );
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px]">
          <thead>
            <tr className="text-xs text-muted-foreground"><th /><th className="font-medium">SPH</th><th className="font-medium">CYL</th><th className="font-medium">AXIS</th></tr>
          </thead>
          <tbody>
            {eye("right", "Right (OD)")}
            {eye("left", "Left (OS)")}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">PD (mm)</span>
          <input type="number" min={40} max={80} step={0.5} className={sel} value={v.pd} onChange={(e) => set({ pd: Number(e.target.value) })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">ADD (reading)</span>
          <select className={sel} value={v.add ?? ""} onChange={(e) => set({ add: e.target.value === "" ? undefined : Number(e.target.value) })}>
            <option value="">None</option>
            {ADD.slice(1).map((n) => <option key={n} value={n}>{fmt(n)}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Copy the values exactly as written on your prescription. Leave CYL and AXIS at 0 if they&apos;re blank.</p>
    </div>
  );
}
