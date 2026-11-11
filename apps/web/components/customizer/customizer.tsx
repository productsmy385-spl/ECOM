"use client";

import type { CustomizerData, DesignView } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import type { CanvasConfig } from "@ecom/ui/design";
import { type CanvasValue, evaluateSelections, isOptionVisible } from "@ecom/validation";
import { AlertCircle, CheckCircle2, Loader2, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";
import { CanvasEditor } from "./canvas-editor";
import { OptionField } from "./option-fields";

interface Props {
  data: CustomizerData;
  design: DesignView | null;
  initialVariantSku?: string;
}

type ApiErr = { error?: string; fieldErrors?: Record<string, string[]> };

export function Customizer({ data, design, initialVariantSku }: Props) {
  const router = useRouter();
  const { product, variants, options } = data;
  const canvasOption = options.find((o) => o.type === "canvas");
  const fieldOptions = options.filter((o) => o.type !== "canvas");

  const startVariant =
    variants.find((v) => v.id === design?.variant?.id) ?? variants.find((v) => v.sku === initialVariantSku) ?? variants.find((v) => v.isDefault) ?? variants[0]!;
  const [variantId, setVariantId] = useState(startVariant.id);
  const [values, setValues] = useState<Record<string, unknown>>(design?.config.options ?? {});
  const [name, setName] = useState(design?.name ?? "My design");
  const [designId, setDesignId] = useState(design?.id ?? null);
  const [version, setVersion] = useState(design?.version ?? 0);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ values: design?.config.options ?? {}, name: design?.name ?? "My design", variantId: startVariant.id }));
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const variant = variants.find((v) => v.id === variantId)!;
  const live = useMemo(() => evaluateSelections(options, values, { requireAll: false }), [options, values]);
  const dirty = JSON.stringify({ values, name, variantId }) !== savedSnapshot;
  const total = variant.price + live.priceDelta;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setValue = (key: string, v: unknown) => {
    setValues((cur) => {
      const next = { ...cur };
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[key];
      else next[key] = v;
      return next;
    });
    setErrors((cur) => {
      const next = { ...cur };
      delete next[key];
      return next;
    });
  };

  function applyServerErrors(body: ApiErr, fallback: string) {
    const fe = body.fieldErrors ?? {};
    setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0] ?? "Check this"])));
    setMessage({ tone: "error", text: body.error ?? fallback });
  }

  /** Saves a new version; returns the saved design id (or null on failure). */
  async function save(): Promise<string | null> {
    setBusy("save");
    setMessage(null);
    try {
      const payload = { name, variantId, config: { options: values } };
      const res = designId
        ? await fetch(`/api/designs/${designId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, baseVersion: version }) })
        : await fetch("/api/designs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, productId: product.id }) });
      const body = (await res.json().catch(() => ({}))) as DesignView & ApiErr;
      if (!res.ok) {
        applyServerErrors(body, res.status === 409 ? "This design was changed elsewhere. Reload the page." : "Couldn't save your design.");
        return null;
      }
      setDesignId(body.id);
      setVersion(body.version);
      // Server-normalised values (e.g. trimmed text) become the new baseline.
      setValues(body.config.options);
      setSavedSnapshot(JSON.stringify({ values: body.config.options, name, variantId }));
      setErrors({});
      setMessage({ tone: "ok", text: "Design saved." });
      const url = new URL(window.location.href);
      url.searchParams.set("design", body.id);
      window.history.replaceState(null, "", url);
      return body.id;
    } catch {
      setMessage({ tone: "error", text: "You appear to be offline. Your changes are still here; try again." });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    const full = evaluateSelections(options, values, { requireAll: true });
    if (!full.ok) {
      setErrors(full.errors);
      setMessage({ tone: "error", text: "Please complete the highlighted options first." });
      return;
    }
    const id = dirty || !designId ? await save() : designId;
    if (!id) return;
    setBusy("submit");
    try {
      const res = await fetch(`/api/designs/${id}/submit`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as ApiErr;
      if (!res.ok) {
        applyServerErrors(body, "Couldn't submit your design.");
        return;
      }
      setSavedSnapshot(JSON.stringify({ values, name, variantId }));
      router.push(`/designs/${id}?submitted=1`);
    } finally {
      setBusy(null);
    }
  }

  // Group visible field options.
  const visible = fieldOptions.filter((o) => isOptionVisible(o, values));
  const groups = [...new Set(visible.map((o) => (o.config as { groupName?: string }).groupName ?? "Options"))];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      {/* ---------------------------------------------------- canvas / preview */}
      <div className="min-w-0 space-y-4 lg:sticky lg:top-40 lg:self-start">
        {canvasOption ? (
          <>
            <div>
              <h2 className="font-display text-lg font-semibold">{canvasOption.label}</h2>
              {(canvasOption.config as { helpText?: string }).helpText && (
                <p className="text-sm text-muted-foreground">{(canvasOption.config as { helpText?: string }).helpText}</p>
              )}
            </div>
            <CanvasEditor
              label={canvasOption.label}
              config={canvasOption.config as unknown as CanvasConfig}
              value={(values[canvasOption.key] as CanvasValue) ?? { layers: [] }}
              onChange={(v) => setValue(canvasOption.key, v.layers.length ? v : undefined)}
            />
            {errors[canvasOption.key] && <p role="alert" className="text-sm text-destructive">{errors[canvasOption.key]}</p>}
          </>
        ) : (
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
            <ProductImage src={product.imageUrl} alt={product.name} hint={product.categoryName} sizes="(min-width: 1024px) 50vw, 100vw" priority />
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- options */}
      <div className="min-w-0 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Customise</p>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight">{product.name}</h1>
          <label className="mt-3 block text-sm">
            <span className="text-muted-foreground">Design name</span>
            <input className="mt-1 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>

        {variants.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Base product</legend>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => (
                <button key={v.id} type="button" aria-pressed={v.id === variantId} onClick={() => setVariantId(v.id)}
                  className={cn("rounded-lg border px-3 py-2 text-sm", v.id === variantId ? "border-primary bg-primary/5 font-medium" : "border-input hover:border-foreground/40", !v.inStock && "opacity-60")}>
                  {v.name} <span className="text-muted-foreground">· {formatPaise(v.price)}</span>
                  {!v.inStock && <span className="ml-1 text-xs text-destructive">(out of stock)</span>}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {groups.map((g) => (
          <section key={g} className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
            {groups.length > 1 && <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{g}</h2>}
            {visible
              .filter((o) => ((o.config as { groupName?: string }).groupName ?? "Options") === g)
              .map((o) => (
                <OptionField key={o.key} option={o} value={values[o.key]} error={errors[o.key]} onChange={(v) => setValue(o.key, v)} />
              ))}
          </section>
        ))}

        {/* -------------------------------------------------- price + actions */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{variant.name}</dt><dd className="tabular-nums">{formatPaise(variant.price)}</dd></div>
            {live.summary.filter((s) => s.priceDelta > 0).map((s) => (
              <div key={s.key} className="flex justify-between"><dt className="text-muted-foreground">{s.label}: {s.value}</dt><dd className="tabular-nums">+{formatPaise(s.priceDelta)}</dd></div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="font-display tabular-nums" aria-live="polite">{formatPaise(total)}</dd>
            </div>
            <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
          </dl>

          {message && (
            <p role={message.tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-sm", message.tone === "error" ? "bg-destructive/5 text-destructive" : "bg-success/5 text-success")}>
              {message.tone === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              {message.text}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={save} disabled={!!busy || (!dirty && !!designId)}
              className="inline-flex h-12 w-full items-center sm:flex-1 justify-center gap-2 rounded-lg border border-input bg-white text-sm font-semibold hover:border-primary disabled:opacity-50">
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {designId && !dirty ? "Saved" : "Save design"}
            </button>
            <button type="button" onClick={submit} disabled={!!busy}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary sm:flex-1 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {product.requiresDesignReview ? "Submit for review" : "Finish design"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {product.requiresDesignReview
              ? "Our design team checks every design before it's made. You can edit it if they suggest changes."
              : "Once finished, your design is locked. You can always duplicate it to make another."}{" "}
            Saved designs are kept on this device{designId ? <> and in <Link href="/designs" className="text-link hover:underline">My designs</Link></> : ""}.
          </p>
        </div>
      </div>
    </div>
  );
}
