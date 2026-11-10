/**
 * Customisation engine: the single definition of what a design is, shared by
 * the admin options builder, the storefront editor and every server write.
 *
 * Option configs (admin-defined, stored in customization_options.config) and
 * selections (customer-chosen, stored in design_versions.config) are both
 * validated here. Canvas coordinates are normalised (0..1 of the canvas), so a
 * design reproduces identically at any render size.
 */
import { z } from "zod";

// ------------------------------------------------------------------ fonts

export const DESIGN_FONTS = [
  { id: "sora", label: "Sora", css: "var(--font-sora), ui-sans-serif, sans-serif" },
  { id: "inter", label: "Inter", css: "var(--font-inter), ui-sans-serif, sans-serif" },
  { id: "playfair", label: "Playfair Display", css: "var(--font-playfair), Georgia, serif" },
  { id: "dancing", label: "Dancing Script", css: "var(--font-dancing), cursive" },
  { id: "bebas", label: "Bebas Neue", css: "var(--font-bebas), Impact, sans-serif" },
] as const;
export type DesignFontId = (typeof DESIGN_FONTS)[number]["id"];
const FONT_IDS = DESIGN_FONTS.map((f) => f.id) as [DesignFontId, ...DesignFontId[]];
export const fontCss = (id: string) => DESIGN_FONTS.find((f) => f.id === id)?.css ?? DESIGN_FONTS[0].css;

export const OPTION_TYPES = ["select", "multiselect", "color", "text", "number", "image", "prescription", "canvas"] as const;
export type OptionType = (typeof OPTION_TYPES)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #CF0F47");
const paise = z.coerce.number().int().min(0).max(10_000_000);
const ikUrl = z
  .url()
  .refine((u) => /^https:\/\/ik\.imagekit\.io\//.test(u), "Images must be uploaded to ImageKit");
const key = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,47}$/, "Key: lowercase letters, numbers, underscores; start with a letter");

// --------------------------------------------------------- option configs

const choice = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  hex: hex.optional(),
  priceDelta: paise.default(0),
});

/** Show this option only when another option has one of these values. */
const showWhen = z.object({ key, values: z.array(z.string().min(1).max(60)).min(1).max(20) }).optional();

const printArea = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0.05).max(1),
    h: z.number().min(0.05).max(1),
  })
  .refine((a) => a.x + a.w <= 1.0001 && a.y + a.h <= 1.0001, "Print area must fit inside the canvas");

export const optionConfigSchemas = {
  select: z.object({ choices: z.array(choice).min(1).max(50), showWhen }),
  color: z.object({ choices: z.array(choice.extend({ hex })).min(1).max(50), showWhen }),
  multiselect: z.object({
    choices: z.array(choice).min(1).max(50),
    maxSelections: z.coerce.number().int().min(1).max(50).default(5),
    showWhen,
  }),
  text: z.object({
    maxLength: z.coerce.number().int().min(1).max(200).default(20),
    placeholder: z.string().max(80).optional(),
    priceDelta: paise.default(0),
    showWhen,
  }),
  number: z
    .object({
      min: z.coerce.number().default(0),
      max: z.coerce.number().default(100),
      step: z.coerce.number().positive().default(1),
      unit: z.string().max(12).optional(),
      showWhen,
    })
    .refine((c) => c.max > c.min, "Max must be greater than min"),
  image: z.object({ priceDelta: paise.default(0), showWhen }),
  prescription: z.object({ priceDelta: paise.default(0), showWhen }),
  canvas: z.object({
    /** Aspect ratio of the design surface (pixels are only a reference size). */
    width: z.coerce.number().int().min(100).max(4000).default(1000),
    height: z.coerce.number().int().min(100).max(4000).default(600),
    background: z
      .object({ color: hex.default("#FFFFFF"), imageUrl: ikUrl.optional() })
      .default({ color: "#FFFFFF" }),
    printArea: printArea.default({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }),
    allowText: z.boolean().default(true),
    allowImages: z.boolean().default(true),
    maxLayers: z.coerce.number().int().min(1).max(30).default(8),
    fonts: z.array(z.enum(FONT_IDS)).min(1).default(["sora", "playfair", "dancing"]),
    priceDelta: paise.default(0),
    showWhen,
  }),
} as const;

export type OptionConfig<T extends OptionType> = z.infer<(typeof optionConfigSchemas)[T]>;

export const optionDefinitionSchema = z
  .object({
    key,
    label: z.string().trim().min(1, "Label is required").max(80),
    helpText: z.string().trim().max(200).optional().transform((v) => v || undefined),
    groupName: z.string().trim().max(60).optional().transform((v) => v || undefined),
    type: z.enum(OPTION_TYPES),
    isRequired: z.boolean().default(false),
    isActive: z.boolean().default(true),
    config: z.unknown(),
  })
  .transform((o, ctx) => {
    const parsed = optionConfigSchemas[o.type].safeParse(o.config ?? {});
    if (!parsed.success) {
      for (const issue of parsed.error.issues) ctx.addIssue({ code: "custom", path: ["config", ...issue.path], message: issue.message });
      return z.NEVER;
    }
    return { ...o, config: parsed.data as Record<string, unknown> };
  });
export type OptionDefinition = z.output<typeof optionDefinitionSchema>;

export const optionSetSchema = z
  .object({ options: z.array(optionDefinitionSchema).max(40) })
  .superRefine(({ options }, ctx) => {
    const keys = options.map((o) => o.key);
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup) ctx.addIssue({ code: "custom", path: ["options"], message: `Key "${dup}" is used twice` });
    if (options.filter((o) => o.type === "canvas").length > 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Only one design canvas per product" });
    }
    for (const o of options) {
      const sw = (o.config as { showWhen?: { key: string } }).showWhen;
      if (sw && !keys.includes(sw.key)) {
        ctx.addIssue({ code: "custom", path: ["options"], message: `"${o.label}" depends on unknown option "${sw.key}"` });
      }
      if (sw?.key === o.key) ctx.addIssue({ code: "custom", path: ["options"], message: `"${o.label}" can't depend on itself` });
    }
  });

// ------------------------------------------------------------ canvas layers

const unit = z.number().min(-0.5).max(1.5); // allow partly off-canvas while dragging
const layerBase = {
  id: z.string().regex(/^[a-z0-9-]{4,40}$/),
  x: unit,
  y: unit,
  rotation: z.number().min(-360).max(360).default(0),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
};

export const textLayerSchema = z.object({
  ...layerBase,
  type: z.literal("text"),
  // Plain text only: rendered as an SVG text node (escaped by React), never as HTML.
  text: z
    .string()
    .max(80)
    .transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim())
    .pipe(z.string().min(1, "Text can't be empty")),
  font: z.enum(FONT_IDS),
  /** Font size as a fraction of canvas height. */
  size: z.number().min(0.02).max(0.6),
  color: hex,
  weight: z.union([z.literal(400), z.literal(700)]).default(400),
  italic: z.boolean().default(false),
  align: z.enum(["start", "middle", "end"]).default("middle"),
});

export const imageLayerSchema = z.object({
  ...layerBase,
  type: z.literal("image"),
  url: ikUrl,
  /** Size as fractions of canvas width/height. */
  w: z.number().min(0.02).max(1.5),
  h: z.number().min(0.02).max(1.5),
});

export const layerSchema = z.discriminatedUnion("type", [textLayerSchema, imageLayerSchema]);
export type TextLayer = z.infer<typeof textLayerSchema>;
export type ImageLayer = z.infer<typeof imageLayerSchema>;
export type Layer = z.infer<typeof layerSchema>;

export const canvasValueSchema = z.object({ layers: z.array(layerSchema).max(30) });
export type CanvasValue = z.infer<typeof canvasValueSchema>;

// ------------------------------------------------------------- prescription

const sph = z.number().min(-20).max(20).multipleOf(0.25);
const cyl = z.number().min(-6).max(6).multipleOf(0.25);
const axis = z.number().int().min(0).max(180);
export const prescriptionSchema = z.object({
  right: z.object({ sph, cyl: cyl.default(0), axis: axis.default(0) }),
  left: z.object({ sph, cyl: cyl.default(0), axis: axis.default(0) }),
  pd: z.number().min(40).max(80),
  add: z.number().min(0).max(4).multipleOf(0.25).optional(),
  notes: z.string().max(200).optional(),
});
export type Prescription = z.infer<typeof prescriptionSchema>;

// ------------------------------------------------- selections + pricing

/** The shape stored in design_versions.config. */
export const designConfigSchema = z.object({
  options: z.record(z.string(), z.unknown()).default({}),
});
export type DesignConfig = { options: Record<string, unknown> };

export interface StoredOption {
  key: string;
  label: string;
  type: OptionType;
  isRequired: boolean;
  config: Record<string, unknown>;
}

export interface SelectionResult {
  ok: boolean;
  errors: Record<string, string>;
  /** Normalised values for visible options only (hidden ones are dropped). */
  values: Record<string, unknown>;
  priceDelta: number;
  /** Human-readable lines for carts, orders and invoices. */
  summary: { key: string; label: string; value: string; priceDelta: number }[];
}

export function isOptionVisible(option: StoredOption, values: Record<string, unknown>): boolean {
  const sw = (option.config as { showWhen?: { key: string; values: string[] } }).showWhen;
  if (!sw) return true;
  const v = values[sw.key];
  return Array.isArray(v) ? v.some((x) => sw.values.includes(String(x))) : sw.values.includes(String(v ?? ""));
}

const empty = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && v !== null && "layers" in v && Array.isArray((v as CanvasValue).layers) && (v as CanvasValue).layers.length === 0);

const fmt = (n: number) => (n / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/**
 * Validates customer selections against a product's options and prices them.
 * Pure and deterministic: the browser uses it for live feedback, the server
 * re-runs it on every save so client prices are never trusted.
 */
export function evaluateSelections(
  options: StoredOption[],
  raw: Record<string, unknown>,
  { requireAll = true }: { requireAll?: boolean } = {},
): SelectionResult {
  const errors: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const summary: SelectionResult["summary"] = [];
  let priceDelta = 0;

  // Resolve in definition order so showWhen can depend on earlier answers.
  for (const o of options) {
    if (!isOptionVisible(o, { ...raw, ...values })) continue;
    const v = raw[o.key];
    if (empty(v)) {
      if (o.isRequired && requireAll) errors[o.key] = `${o.label} is required`;
      continue;
    }
    const c = o.config as Record<string, unknown>;
    const add = (label: string, delta: number, value: unknown) => {
      values[o.key] = value;
      priceDelta += delta;
      summary.push({ key: o.key, label: o.label, value: label, priceDelta: delta });
    };

    switch (o.type) {
      case "select":
      case "color": {
        const ch = (c.choices as z.infer<typeof choice>[]).find((x) => x.value === v);
        if (!ch) errors[o.key] = `Choose a valid ${o.label.toLowerCase()}`;
        else add(ch.label, ch.priceDelta ?? 0, ch.value);
        break;
      }
      case "multiselect": {
        const picked = Array.isArray(v) ? [...new Set(v.map(String))] : [];
        const all = c.choices as z.infer<typeof choice>[];
        const chosen = all.filter((x) => picked.includes(x.value));
        if (chosen.length !== picked.length) errors[o.key] = `Choose valid ${o.label.toLowerCase()}`;
        else if (chosen.length > Number(c.maxSelections ?? 5)) errors[o.key] = `Choose at most ${c.maxSelections}`;
        else add(chosen.map((x) => x.label).join(", "), chosen.reduce((s, x) => s + (x.priceDelta ?? 0), 0), chosen.map((x) => x.value));
        break;
      }
      case "text": {
        const s = String(v).replace(/[\u0000-\u001f\u007f]/g, "").trim();
        if (s.length > Number(c.maxLength ?? 20)) errors[o.key] = `Use at most ${c.maxLength} characters`;
        else if (s) add(s, Number(c.priceDelta ?? 0), s);
        else if (o.isRequired && requireAll) errors[o.key] = `${o.label} is required`;
        break;
      }
      case "number": {
        const n = Number(v);
        const min = Number(c.min);
        const max = Number(c.max);
        const step = Number(c.step ?? 1);
        if (!Number.isFinite(n) || n < min || n > max) errors[o.key] = `Enter a value between ${min} and ${max}`;
        else if (Math.abs((n - min) / step - Math.round((n - min) / step)) > 1e-9) errors[o.key] = `Use steps of ${step}`;
        else add(`${n}${c.unit ? ` ${c.unit}` : ""}`, 0, n);
        break;
      }
      case "image": {
        const parsed = ikUrl.safeParse(v);
        if (!parsed.success) errors[o.key] = "Upload an image";
        else add("Uploaded image", Number(c.priceDelta ?? 0), parsed.data);
        break;
      }
      case "prescription": {
        const parsed = prescriptionSchema.safeParse(v);
        if (!parsed.success) errors[o.key] = "Check the prescription values";
        else {
          const p = parsed.data;
          add(`R ${p.right.sph}/${p.right.cyl}×${p.right.axis}, L ${p.left.sph}/${p.left.cyl}×${p.left.axis}, PD ${p.pd}`, Number(c.priceDelta ?? 0), p);
        }
        break;
      }
      case "canvas": {
        const parsed = canvasValueSchema.safeParse(v);
        if (!parsed.success) {
          errors[o.key] = parsed.error.issues[0]?.message ?? "The design has an invalid layer";
          break;
        }
        const layers = parsed.data.layers;
        if (layers.length > Number(c.maxLayers ?? 8)) errors[o.key] = `Use at most ${c.maxLayers} layers`;
        else if (!c.allowText && layers.some((l) => l.type === "text")) errors[o.key] = "Text isn't allowed on this product";
        else if (!c.allowImages && layers.some((l) => l.type === "image")) errors[o.key] = "Images aren't allowed on this product";
        else if (layers.some((l) => l.type === "text" && !(c.fonts as string[]).includes(l.font))) errors[o.key] = "Choose one of the available fonts";
        else {
          const n = layers.filter((l) => l.visible).length;
          add(`${n} design layer${n === 1 ? "" : "s"}`, n > 0 ? Number(c.priceDelta ?? 0) : 0, parsed.data);
        }
        break;
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, values, priceDelta, summary };
}

export const formatDelta = (paiseValue: number) => (paiseValue > 0 ? `+${fmt(paiseValue)}` : "");

// ------------------------------------------------------- design requests

export const designSaveSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  name: z.string().trim().min(1).max(80).default("My design"),
  config: designConfigSchema,
});

export const designUpdateSchema = z.object({
  variantId: z.uuid().optional(),
  name: z.string().trim().min(1).max(80).optional(),
  config: designConfigSchema,
  /** Optimistic concurrency: the version the client edited. */
  baseVersion: z.number().int().min(1),
});

export const designReviewSchema = z
  .object({
    decision: z.enum(["approved", "changes_requested", "rejected"]),
    comment: z.string().trim().max(1000).optional(),
  })
  .refine((r) => r.decision === "approved" || (r.comment?.length ?? 0) >= 5, {
    path: ["comment"],
    message: "Tell the customer what to change (at least 5 characters)",
  });

export const designAssignSchema = z.object({ designerId: z.uuid().nullable() });
export const designNoteSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export const adminDesignListQuery = z.object({
  status: z.enum(["draft", "submitted", "in_review", "awaiting_customer", "changes_requested", "approved", "rejected"]).optional(),
  mine: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
