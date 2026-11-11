"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError, api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { type CanvasConfig, DesignSurface } from "@ecom/ui/design";
import { DESIGN_FONTS, OPTION_TYPES, type OptionType } from "@ecom/validation";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Plus, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PHOTO_FRAME_PRESET, RESIN_FRAME_PRESET } from "./presets";

type Choice = { value: string; label: string; hex?: string; priceDelta: number };
type Cfg = Record<string, unknown> & { choices?: Choice[]; showWhen?: { key: string; values: string[] } };

export interface EditableOption {
  key: string;
  label: string;
  helpText?: string | null;
  groupName?: string | null;
  type: OptionType;
  isRequired: boolean;
  isActive: boolean;
  config: Cfg;
}

const TYPE_LABEL: Record<OptionType, string> = {
  select: "Choice list",
  color: "Colour swatches",
  multiselect: "Multiple choice",
  text: "Text (engraving, names)",
  number: "Number",
  image: "Image upload",
  prescription: "Eyeglass prescription",
  canvas: "Design canvas",
};

const DEFAULT_CONFIG: Record<OptionType, Cfg> = {
  select: { choices: [{ value: "option_1", label: "Option 1", priceDelta: 0 }] },
  color: { choices: [{ value: "black", label: "Black", hex: "#000000", priceDelta: 0 }] },
  multiselect: { maxSelections: 3, choices: [{ value: "option_1", label: "Option 1", priceDelta: 0 }] },
  text: { maxLength: 20, placeholder: "", priceDelta: 0 },
  number: { min: 0, max: 100, step: 1, unit: "" },
  image: { priceDelta: 0 },
  prescription: { priceDelta: 0 },
  canvas: {
    width: 1000, height: 600, background: { color: "#FFFFFF" }, printArea: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    allowText: true, allowImages: true, maxLayers: 8, fonts: ["sora", "playfair", "dancing"], priceDelta: 0,
  },
};

const rupees = (paise: unknown) => String(Number(paise ?? 0) / 100);
const paise = (r: string) => Math.max(0, Math.round(Number(r || 0) * 100));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "o_$1").slice(0, 48) || "option";

function uniqueKey(base: string, taken: string[]) {
  let k = slug(base);
  for (let i = 2; taken.includes(k); i++) k = `${slug(base)}_${i}`;
  return k;
}

interface Props {
  product: { id: string; name: string; slug: string; status: string; requiresDesignReview: boolean };
  initial: EditableOption[];
  canEdit: boolean;
  webUrl: string;
}

export function OptionsBuilder({ product, initial, canEdit, webUrl }: Props) {
  const [options, setOptions] = useState<EditableOption[]>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [newType, setNewType] = useState<OptionType>("select");
  const dirty = JSON.stringify(options) !== saved;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (i: number, p: Partial<EditableOption>) => setOptions((o) => o.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const patchCfg = (i: number, p: Cfg) => setOptions((o) => o.map((x, j) => (j === i ? { ...x, config: { ...x.config, ...p } } : x)));
  const move = (i: number, d: -1 | 1) =>
    setOptions((o) => {
      const n = [...o];
      [n[i], n[i + d]] = [n[i + d]!, n[i]!];
      return n;
    });

  function add() {
    if (newType === "canvas" && options.some((o) => o.type === "canvas")) {
      toast.error("A product can have only one design canvas.");
      return;
    }
    const label = TYPE_LABEL[newType].split(" (")[0]!;
    setOptions((o) => [...o, { key: uniqueKey(label, o.map((x) => x.key)), label, type: newType, isRequired: false, isActive: true, config: structuredClone(DEFAULT_CONFIG[newType]) }]);
  }

  function applyPreset(preset: EditableOption[]) {
    setOptions(structuredClone(preset));
    toast.info("Preset loaded. Review it, then save.");
  }

  async function save() {
    setSaving(true);
    setIssues([]);
    try {
      const body = {
        options: options.map((o) => ({ ...o, helpText: o.helpText || undefined, groupName: o.groupName || undefined })),
      };
      const res = await api<EditableOption[]>(`/products/${product.id}/options`, { method: "PUT", body });
      setOptions(res);
      setSaved(JSON.stringify(res));
      toast.success(res.some((o) => o.isActive) ? "Options saved. Customers can now customise this product." : "Options saved.");
    } catch (err) {
      if (err instanceof ApiError && err.issues?.length) setIssues(err.issues);
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const issueFor = (i: number) => issues.filter((x) => x.path.startsWith(`options.${i}.`) || x.path === `options.${i}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customisation options"
        description={`${product.name}: what customers can personalise, and what it costs.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/products/${product.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft className="h-4 w-4" /> Product
            </Link>
            {product.status === "published" && saved !== "[]" && (
              <a href={`${webUrl}/customize/${product.id}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <ExternalLink className="h-4 w-4" /> Try it in the store
              </a>
            )}
            {canEdit && (
              <Button size="sm" onClick={save} isLoading={saving} disabled={!dirty}>
                Save options
              </Button>
            )}
          </div>
        }
      />

      {!product.requiresDesignReview && options.some((o) => o.type === "canvas" || o.type === "image") && (
        <p className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          This product accepts custom artwork but doesn&apos;t require design review. Customer designs will be accepted without staff checking them. Turn on “Designer reviews each customised order” on the product if you want a check.
        </p>
      )}

      {issues.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p className="font-semibold">Fix these before saving:</p>
          <ul className="mt-1 list-disc pl-5">
            {issues.slice(0, 8).map((x) => (
              <li key={x.path + x.message}>
                {x.path.replace(/^options\.(\d+)/, (_, n) => `“${options[Number(n)]?.label ?? `Option ${Number(n) + 1}`}”`)}: {x.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {options.length === 0 && (
        <Card className="p-8 text-center">
          <Wand2 className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 font-semibold">No customisation options yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Start from a preset or add options one by one. Customers see them on the product&apos;s “Customise” page.</p>
          {canEdit && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => applyPreset(PHOTO_FRAME_PRESET)}>Photo frame preset</Button>
              <Button variant="outline" onClick={() => applyPreset(RESIN_FRAME_PRESET)}>Resin frame preset</Button>
            </div>
          )}
        </Card>
      )}

      <fieldset disabled={!canEdit} className="space-y-4">
        {options.map((o, i) => {
          const errs = issueFor(i);
          const earlier = options.slice(0, i).filter((x) => Array.isArray(x.config.choices));
          return (
            <Card key={i} className={cn("space-y-4 p-5", !o.isActive && "opacity-70", errs.length && "border-destructive/50")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{TYPE_LABEL[o.type]}</Badge>
                  {o.isRequired && <Badge>Required</Badge>}
                  {!o.isActive && <Badge variant="outline">Hidden</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === options.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${o.label}`} className="text-destructive" onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input label="Label" value={o.label} onChange={(e) => patch(i, { label: e.target.value })} />
                <Input label="Key" hint="Stable id stored in designs." value={o.key} onChange={(e) => patch(i, { key: slug(e.target.value) })} />
                <Input label="Group (optional)" placeholder="Frame, Resin, Personalise…" value={o.groupName ?? ""} onChange={(e) => patch(i, { groupName: e.target.value })} />
                <Input label="Help text (optional)" value={o.helpText ?? ""} onChange={(e) => patch(i, { helpText: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-5">
                <Checkbox label="Required" checked={o.isRequired} onChange={(e) => patch(i, { isRequired: e.target.checked })} />
                <Checkbox label="Visible to customers" checked={o.isActive} onChange={(e) => patch(i, { isActive: e.target.checked })} />
              </div>

              <TypeSettings option={o} onChange={(p) => patchCfg(i, p)} />

              {earlier.length > 0 && (
                <ShowWhenEditor
                  value={o.config.showWhen}
                  candidates={earlier}
                  onChange={(showWhen) => setOptions((x) => x.map((y, j) => (j === i ? { ...y, config: { ...y.config, showWhen } } : y)))}
                />
              )}

              {errs.length > 0 && (
                <ul className="text-xs text-destructive">
                  {errs.map((x) => (
                    <li key={x.path}>{x.path.replace(`options.${i}.`, "")}: {x.message}</li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </fieldset>

      {canEdit && (
        <Card className="flex flex-wrap items-end gap-3 p-5">
          <div className="min-w-56 flex-1">
            <Select label="Add an option" value={newType} onChange={(e) => setNewType(e.target.value as OptionType)}>
              {OPTION_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </Select>
          </div>
          <Button variant="outline" onClick={add}><Plus className="h-4 w-4" /> Add option</Button>
          {options.length > 0 && (
            <ConfirmDialog
              title="Replace with a preset?"
              description="Your current (unsaved) options will be replaced. Nothing changes until you save."
              confirmLabel="Use photo frame preset"
              onConfirm={() => applyPreset(PHOTO_FRAME_PRESET)}
              trigger={<Button variant="ghost">Photo frame preset</Button>}
            />
          )}
          {options.length > 0 && (
            <ConfirmDialog
              title="Replace with a preset?"
              description="Your current (unsaved) options will be replaced. Nothing changes until you save."
              confirmLabel="Use resin frame preset"
              onConfirm={() => applyPreset(RESIN_FRAME_PRESET)}
              trigger={<Button variant="ghost">Resin frame preset</Button>}
            />
          )}
        </Card>
      )}
    </div>
  );
}

// ------------------------------------------------------------ per type

function TypeSettings({ option, onChange }: { option: EditableOption; onChange: (p: Cfg) => void }) {
  const c = option.config;
  switch (option.type) {
    case "select":
    case "color":
    case "multiselect":
      return (
        <div className="space-y-3">
          {option.type === "multiselect" && (
            <div className="max-w-40">
              <Input label="Max selections" type="number" min={1} value={String(c.maxSelections ?? 3)} onChange={(e) => onChange({ maxSelections: Number(e.target.value) })} />
            </div>
          )}
          <ChoicesEditor withHex={option.type === "color"} choices={c.choices ?? []} onChange={(choices) => onChange({ choices })} />
        </div>
      );
    case "text":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Max characters" type="number" min={1} max={200} value={String(c.maxLength ?? 20)} onChange={(e) => onChange({ maxLength: Number(e.target.value) })} />
          <Input label="Placeholder" value={String(c.placeholder ?? "")} onChange={(e) => onChange({ placeholder: e.target.value })} />
          <Input label="Extra price (₹)" type="number" min={0} step="0.01" value={rupees(c.priceDelta)} onChange={(e) => onChange({ priceDelta: paise(e.target.value) })} />
        </div>
      );
    case "number":
      return (
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="Min" type="number" value={String(c.min ?? 0)} onChange={(e) => onChange({ min: Number(e.target.value) })} />
          <Input label="Max" type="number" value={String(c.max ?? 100)} onChange={(e) => onChange({ max: Number(e.target.value) })} />
          <Input label="Step" type="number" value={String(c.step ?? 1)} onChange={(e) => onChange({ step: Number(e.target.value) })} />
          <Input label="Unit" placeholder="mm" value={String(c.unit ?? "")} onChange={(e) => onChange({ unit: e.target.value })} />
        </div>
      );
    case "image":
    case "prescription":
      return (
        <div className="max-w-48">
          <Input label="Extra price (₹)" type="number" min={0} step="0.01" value={rupees(c.priceDelta)} onChange={(e) => onChange({ priceDelta: paise(e.target.value) })} />
        </div>
      );
    case "canvas":
      return <CanvasSettings config={c} onChange={onChange} />;
  }
}

function ChoicesEditor({ choices, withHex, onChange }: { choices: Choice[]; withHex: boolean; onChange: (c: Choice[]) => void }) {
  const set = (i: number, p: Partial<Choice>) => onChange(choices.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Choices</p>
      {choices.map((ch, i) => (
        <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_120px_auto]">
          <Input aria-label="Choice label" placeholder="Label" value={ch.label} onChange={(e) => set(i, { label: e.target.value, value: ch.value || slug(e.target.value) })} />
          <Input aria-label="Choice value" placeholder="value" value={ch.value} onChange={(e) => set(i, { value: slug(e.target.value) })} />
          {withHex ? (
            <input type="color" aria-label="Swatch colour" className="h-9 w-12 cursor-pointer rounded-lg border border-input p-1" value={ch.hex ?? "#000000"} onChange={(e) => set(i, { hex: e.target.value.toUpperCase() })} />
          ) : (
            <span />
          )}
          <Input aria-label="Extra price in rupees" placeholder="+₹0" type="number" min={0} step="0.01" value={rupees(ch.priceDelta)} onChange={(e) => set(i, { priceDelta: paise(e.target.value) })} />
          <Button variant="ghost" size="icon" aria-label="Remove choice" disabled={choices.length <= 1} onClick={() => onChange(choices.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...choices, { value: `option_${choices.length + 1}`, label: `Option ${choices.length + 1}`, hex: withHex ? "#CCCCCC" : undefined, priceDelta: 0 }])}>
        <Plus className="h-4 w-4" /> Add choice
      </Button>
    </div>
  );
}

function ShowWhenEditor({
  value,
  candidates,
  onChange,
}: {
  value?: { key: string; values: string[] };
  candidates: EditableOption[];
  onChange: (v: { key: string; values: string[] } | undefined) => void;
}) {
  const dep = candidates.find((c) => c.key === value?.key);
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52">
          <Select label="Show only when…" value={value?.key ?? ""} onChange={(e) => onChange(e.target.value ? { key: e.target.value, values: [] } : undefined)}>
            <option value="">Always show</option>
            {candidates.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </Select>
        </div>
        {dep && (
          <div className="flex flex-wrap gap-3 pb-2">
            <span className="text-sm text-muted-foreground">is</span>
            {(dep.config.choices ?? []).map((ch) => (
              <Checkbox
                key={ch.value}
                label={ch.label}
                checked={value!.values.includes(ch.value)}
                onChange={(e) => onChange({ key: dep.key, values: e.target.checked ? [...value!.values, ch.value] : value!.values.filter((v) => v !== ch.value) })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CanvasSettings({ config, onChange }: { config: Cfg; onChange: (p: Cfg) => void }) {
  const bg = (config.background as { color: string; imageUrl?: string }) ?? { color: "#FFFFFF" };
  const pa = (config.printArea as { x: number; y: number; w: number; h: number }) ?? { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  const fonts = (config.fonts as string[]) ?? [];
  const pct = (n: number) => String(Math.round(n * 100));
  const setPa = (k: keyof typeof pa, v: string) => onChange({ printArea: { ...pa, [k]: Math.min(1, Math.max(0, Number(v) / 100)) } });
  const previewConfig = {
    width: Number(config.width ?? 1000),
    height: Number(config.height ?? 600),
    background: bg,
    printArea: pa,
  } as CanvasConfig;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="Width (px)" type="number" value={String(config.width ?? 1000)} onChange={(e) => onChange({ width: Number(e.target.value) })} />
          <Input label="Height (px)" type="number" value={String(config.height ?? 600)} onChange={(e) => onChange({ height: Number(e.target.value) })} />
          <Input label="Max layers" type="number" min={1} max={30} value={String(config.maxLayers ?? 8)} onChange={(e) => onChange({ maxLayers: Number(e.target.value) })} />
          <Input label="Extra price (₹)" type="number" min={0} step="0.01" value={rupees(config.priceDelta)} onChange={(e) => onChange({ priceDelta: paise(e.target.value) })} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Print area (% of canvas)</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Input aria-label="Left %" label="Left" type="number" value={pct(pa.x)} onChange={(e) => setPa("x", e.target.value)} />
            <Input aria-label="Top %" label="Top" type="number" value={pct(pa.y)} onChange={(e) => setPa("y", e.target.value)} />
            <Input aria-label="Width %" label="Width" type="number" value={pct(pa.w)} onChange={(e) => setPa("w", e.target.value)} />
            <Input aria-label="Height %" label="Height" type="number" value={pct(pa.h)} onChange={(e) => setPa("h", e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm">
            Background
            <input type="color" className="h-8 w-10 rounded border border-input p-0.5" value={bg.color} onChange={(e) => onChange({ background: { ...bg, color: e.target.value.toUpperCase() } })} />
          </label>
          <Checkbox label="Allow text" checked={config.allowText !== false} onChange={(e) => onChange({ allowText: e.target.checked })} />
          <Checkbox label="Allow images" checked={config.allowImages !== false} onChange={(e) => onChange({ allowImages: e.target.checked })} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Fonts customers can use</p>
          <div className="flex flex-wrap gap-4">
            {DESIGN_FONTS.map((f) => (
              <Checkbox
                key={f.id}
                label={<span style={{ fontFamily: f.css }}>{f.label}</span>}
                checked={fonts.includes(f.id)}
                onChange={(e) => onChange({ fonts: e.target.checked ? [...fonts, f.id] : fonts.filter((x) => x !== f.id) })}
              />
            ))}
          </div>
        </div>
        <ImageUpload
          label="Product mock-up behind the design (optional)"
          folder="/mockups"
          value={bg.imageUrl ?? null}
          onChange={(img) => onChange({ background: { color: bg.color, ...(img ? { imageUrl: img.url } : {}) } })}
        />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Preview</p>
        <div className="overflow-hidden rounded-lg border border-border">
          <DesignSurface config={previewConfig} value={{ layers: [] }} showPrintArea title="Canvas preview" />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">The dashed box is where customers can place artwork.</p>
      </div>
    </div>
  );
}
