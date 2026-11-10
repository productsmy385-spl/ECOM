import { describe, expect, it } from "vitest";
import { evaluateSelections, optionSetSchema, type StoredOption } from "./customization";

const IK = "https://ik.imagekit.io/demo/designs/logo.png";

const raw = [
  { key: "frame_color", label: "Frame colour", type: "color", isRequired: true, config: { choices: [
    { value: "black", label: "Black", hex: "#000000" },
    { value: "crimson", label: "Crimson", hex: "#CF0F47", priceDelta: 20000 },
  ] } },
  { key: "lens_type", label: "Lens type", type: "select", isRequired: true, config: { choices: [
    { value: "plain", label: "Zero power" },
    { value: "prescription", label: "Prescription", priceDelta: 100000 },
  ] } },
  { key: "rx", label: "Prescription", type: "prescription", isRequired: true, config: { priceDelta: 0, showWhen: { key: "lens_type", values: ["prescription"] } } },
  { key: "coatings", label: "Coatings", type: "multiselect", config: { maxSelections: 2, choices: [
    { value: "ar", label: "Anti-glare", priceDelta: 50000 },
    { value: "blue", label: "Blue cut", priceDelta: 70000 },
    { value: "uv", label: "UV" },
  ] } },
  { key: "engraving", label: "Engraving", type: "text", config: { maxLength: 12, priceDelta: 15000 } },
  { key: "label", label: "Label design", type: "canvas", config: { maxLayers: 2, allowImages: true, allowText: true, fonts: ["sora", "dancing"], priceDelta: 30000 } },
];

const parsed = optionSetSchema.parse({ options: raw });
const options = parsed.options as unknown as StoredOption[];

const text = (t: string, extra: Record<string, unknown> = {}) => ({ id: "layer-1", type: "text", text: t, x: 0.5, y: 0.5, font: "sora", size: 0.1, color: "#000000", ...extra });

describe("option definitions", () => {
  it("fills config defaults and keeps the definition order", () => {
    expect(parsed.options.map((o) => o.key)).toEqual(["frame_color", "lens_type", "rx", "coatings", "engraving", "label"]);
    expect((parsed.options[5]!.config as { width: number }).width).toBe(1000);
  });

  it("rejects duplicate keys, two canvases, unknown showWhen keys and bad configs", () => {
    expect(optionSetSchema.safeParse({ options: [raw[0], raw[0]] }).success).toBe(false);
    expect(optionSetSchema.safeParse({ options: [raw[5], { ...raw[5], key: "label2" }] }).success).toBe(false);
    expect(optionSetSchema.safeParse({ options: [raw[2]] }).success).toBe(false); // depends on lens_type
    expect(optionSetSchema.safeParse({ options: [{ ...raw[0], config: { choices: [{ value: "x", label: "X" }] } }] }).success).toBe(false); // colour needs hex
    expect(optionSetSchema.safeParse({ options: [{ ...raw[0], key: "Bad Key" }] }).success).toBe(false);
  });
});

describe("evaluateSelections", () => {
  it("prices a valid selection and builds a readable summary", () => {
    const r = evaluateSelections(options, { frame_color: "crimson", lens_type: "plain", coatings: ["ar", "uv"], engraving: "  Asha  " });
    expect(r.ok).toBe(true);
    expect(r.priceDelta).toBe(20000 + 50000 + 15000);
    expect(r.values.engraving).toBe("Asha");
    expect(r.summary.map((s) => s.value)).toEqual(["Crimson", "Zero power", "Anti-glare, UV", "Asha"]);
  });

  it("requires required options and rejects unknown choices", () => {
    const r = evaluateSelections(options, { frame_color: "gold" });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(["frame_color", "lens_type"]);
  });

  it("shows the prescription only for prescription lenses, and validates it", () => {
    const hidden = evaluateSelections(options, { frame_color: "black", lens_type: "plain", rx: { junk: true } });
    expect(hidden.ok).toBe(true);
    expect(hidden.values).not.toHaveProperty("rx"); // hidden answers are dropped

    const missing = evaluateSelections(options, { frame_color: "black", lens_type: "prescription" });
    expect(missing.errors.rx).toMatch(/required/);

    const bad = evaluateSelections(options, { frame_color: "black", lens_type: "prescription", rx: { right: { sph: -2.3 }, left: { sph: -2 }, pd: 62 } });
    expect(bad.errors.rx).toBeDefined(); // -2.3 is not a 0.25 step

    const good = evaluateSelections(options, {
      frame_color: "black",
      lens_type: "prescription",
      rx: { right: { sph: -2.25, cyl: -0.5, axis: 90 }, left: { sph: -2, cyl: 0, axis: 0 }, pd: 62 },
    });
    expect(good.ok).toBe(true);
    expect(good.priceDelta).toBe(100000);
  });

  it("drafts may be incomplete, but invalid values are still rejected", () => {
    const draft = evaluateSelections(options, { engraving: "Hi" }, { requireAll: false });
    expect(draft.ok).toBe(true);
    const bad = evaluateSelections(options, { frame_color: "gold" }, { requireAll: false });
    expect(bad.errors.frame_color).toBeDefined();
  });

  it("enforces multiselect and text limits", () => {
    expect(evaluateSelections(options, { frame_color: "black", lens_type: "plain", coatings: ["ar", "blue", "uv"] }).errors.coatings).toMatch(/at most 2/);
    expect(evaluateSelections(options, { frame_color: "black", lens_type: "plain", engraving: "x".repeat(13) }).errors.engraving).toMatch(/12/);
  });

  it("validates canvas layers: count, fonts, image hosts", () => {
    const base = { frame_color: "black", lens_type: "plain" };
    const ok = evaluateSelections(options, { ...base, label: { layers: [text("Rosa")] } });
    expect(ok.ok).toBe(true);
    expect(ok.priceDelta).toBe(30000);

    expect(evaluateSelections(options, { ...base, label: { layers: [text("a"), text("b", { id: "layer-2" }), text("c", { id: "layer-3" })] } }).errors.label).toMatch(/at most 2/);
    expect(evaluateSelections(options, { ...base, label: { layers: [text("a", { font: "bebas" })] } }).errors.label).toMatch(/fonts/);
    const foreign = { id: "img-1", type: "image", url: "https://evil.example/x.png", x: 0.5, y: 0.5, w: 0.3, h: 0.3 };
    expect(evaluateSelections(options, { ...base, label: { layers: [foreign] } }).ok).toBe(false);
    const ik = { ...foreign, url: IK };
    expect(evaluateSelections(options, { ...base, label: { layers: [ik] } }).ok).toBe(true);
  });

  it("treats text as text: markup is kept verbatim (rendered escaped), control characters stripped", () => {
    const r = evaluateSelections(options, { frame_color: "black", lens_type: "plain", label: { layers: [text("<b>Hi</b>\u0007")] } });
    expect(r.ok).toBe(true);
    const layer = (r.values.label as { layers: { text: string }[] }).layers[0]!;
    expect(layer.text).toBe("<b>Hi</b>");
  });

  it("an empty canvas costs nothing and is not required", () => {
    const r = evaluateSelections(options, { frame_color: "black", lens_type: "plain", label: { layers: [] } });
    expect(r.ok).toBe(true);
    expect(r.priceDelta).toBe(0);
  });
});
