/** Starting points for common product types. Admins adjust them before saving. */
import type { EditableOption } from "./options-builder";

export const EYEWEAR_PRESET: EditableOption[] = [
  {
    key: "frame_color", label: "Frame colour", type: "color", isRequired: true, isActive: true, groupName: "Frame",
    config: { choices: [
      { value: "black", label: "Black", hex: "#000000", priceDelta: 0 },
      { value: "crimson", label: "Crimson", hex: "#CF0F47", priceDelta: 0 },
      { value: "tortoise", label: "Tortoise", hex: "#6B3E26", priceDelta: 20000 },
    ] },
  },
  {
    key: "lens_type", label: "Lens type", type: "select", isRequired: true, isActive: true, groupName: "Lenses",
    config: { choices: [
      { value: "plain", label: "Zero power", priceDelta: 0 },
      { value: "prescription", label: "Prescription", priceDelta: 100000 },
    ] },
  },
  {
    key: "prescription", label: "Prescription", type: "prescription", isRequired: true, isActive: true, groupName: "Lenses",
    helpText: "Enter the values from your eye test.",
    config: { priceDelta: 0, showWhen: { key: "lens_type", values: ["prescription"] } },
  },
  {
    key: "lens_color", label: "Lens tint", type: "color", isRequired: false, isActive: true, groupName: "Lenses",
    config: { choices: [
      { value: "clear", label: "Clear", hex: "#F5F5F5", priceDelta: 0 },
      { value: "grey", label: "Grey", hex: "#6B6B6B", priceDelta: 30000 },
      { value: "rose", label: "Rose", hex: "#FFDEDE", priceDelta: 30000 },
    ] },
  },
  {
    key: "coatings", label: "Lens coatings", type: "multiselect", isRequired: false, isActive: true, groupName: "Lenses",
    config: { maxSelections: 3, choices: [
      { value: "anti_glare", label: "Anti-glare", priceDelta: 50000 },
      { value: "blue_cut", label: "Blue-light filter", priceDelta: 70000 },
      { value: "scratch", label: "Scratch-resistant", priceDelta: 30000 },
    ] },
  },
  {
    key: "engraving", label: "Temple engraving", type: "text", isRequired: false, isActive: true, groupName: "Personalise",
    helpText: "Up to 15 characters, engraved on the inside of the arm.",
    config: { maxLength: 15, placeholder: "Your name", priceDelta: 15000 },
  },
];

export const COSMETICS_PRESET: EditableOption[] = [
  {
    key: "shade", label: "Shade", type: "color", isRequired: true, isActive: true, groupName: "Product",
    config: { choices: [
      { value: "crimson", label: "Crimson", hex: "#CF0F47", priceDelta: 0 },
      { value: "hot_pink", label: "Hot Pink", hex: "#FF0B55", priceDelta: 0 },
      { value: "nude", label: "Nude Rose", hex: "#C99A8B", priceDelta: 0 },
    ] },
  },
  {
    key: "fragrance", label: "Fragrance", type: "select", isRequired: false, isActive: true, groupName: "Product",
    config: { choices: [
      { value: "none", label: "Unscented", priceDelta: 0 },
      { value: "rose", label: "Rose", priceDelta: 5000 },
      { value: "vanilla", label: "Vanilla", priceDelta: 5000 },
    ] },
  },
  {
    key: "packaging", label: "Packaging", type: "select", isRequired: true, isActive: true, groupName: "Packaging",
    config: { choices: [
      { value: "standard", label: "Standard", priceDelta: 0 },
      { value: "gift_box", label: "Gift box", priceDelta: 9900 },
    ] },
  },
  {
    key: "brand_name", label: "Name on product", type: "text", isRequired: false, isActive: true, groupName: "Personalise",
    config: { maxLength: 20, placeholder: "e.g. Asha's", priceDelta: 0 },
  },
  {
    key: "label", label: "Label design", type: "canvas", isRequired: false, isActive: true, groupName: "Personalise",
    helpText: "Design your own label: add text, your logo or a photo.",
    config: {
      width: 1000, height: 600, background: { color: "#FFDEDE" },
      printArea: { x: 0.08, y: 0.1, w: 0.84, h: 0.8 },
      allowText: true, allowImages: true, maxLayers: 6,
      fonts: ["sora", "playfair", "dancing", "bebas"], priceDelta: 20000,
    },
  },
];
