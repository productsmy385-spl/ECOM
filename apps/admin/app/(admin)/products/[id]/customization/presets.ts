/** Starting points for common frame types. Admins adjust them before saving. */
import type { EditableOption } from "./options-builder";

const FRAME_COLOUR: EditableOption = {
  key: "frame_colour", label: "Frame colour", type: "color", isRequired: true, isActive: true, groupName: "Frame",
  config: { choices: [
    { value: "black", label: "Black", hex: "#1B1B1B", priceDelta: 0 },
    { value: "white", label: "White", hex: "#F4F1EC", priceDelta: 0 },
    { value: "walnut", label: "Walnut", hex: "#6B4423", priceDelta: 0 },
    { value: "gold", label: "Gold", hex: "#C9A227", priceDelta: 20000 },
  ] },
};

const SIZE: EditableOption = {
  key: "size", label: "Size", type: "select", isRequired: true, isActive: true, groupName: "Frame",
  config: { choices: [
    { value: "5x7", label: "5 × 7 in", priceDelta: 0 },
    { value: "8x10", label: "8 × 10 in", priceDelta: 30000 },
    { value: "a4", label: "A4 (8.3 × 11.7 in)", priceDelta: 50000 },
    { value: "12x18", label: "12 × 18 in", priceDelta: 90000 },
  ] },
};

/** Custom photo frame: frame, size, the customer's photo (design studio) and an optional name/message. */
export const PHOTO_FRAME_PRESET: EditableOption[] = [
  FRAME_COLOUR,
  SIZE,
  {
    key: "photo", label: "Your photo", type: "canvas", isRequired: true, isActive: true, groupName: "Personalise",
    helpText: "Upload a photo and add text. Our designers check it before printing.",
    config: {
      width: 800, height: 1000, background: { color: "#FFFFFF" },
      printArea: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
      allowText: true, allowImages: true, maxLayers: 8,
      fonts: ["playfair", "dancing", "sora"], priceDelta: 0,
    },
  },
  {
    key: "name_text", label: "Name or message", type: "text", isRequired: false, isActive: true, groupName: "Personalise",
    config: { maxLength: 30, placeholder: "e.g. Riya & Arjun", priceDelta: 9900 },
  },
];

/** Resin (glue-art) frame: flowers, resin finish, frame colour and a name set in resin. */
export const RESIN_FRAME_PRESET: EditableOption[] = [
  {
    key: "flowers", label: "Flowers", type: "select", isRequired: true, isActive: true, groupName: "Resin",
    config: { choices: [
      { value: "rose", label: "Rose petals", priceDelta: 0 },
      { value: "babys_breath", label: "Baby's breath", priceDelta: 0 },
      { value: "lavender", label: "Lavender", priceDelta: 0 },
      { value: "wildflowers", label: "Mixed wildflowers", priceDelta: 15000 },
    ] },
  },
  {
    key: "finish", label: "Resin finish", type: "select", isRequired: true, isActive: true, groupName: "Resin",
    config: { choices: [
      { value: "clear", label: "Crystal clear", priceDelta: 0 },
      { value: "pink", label: "Blush pink tint", priceDelta: 0 },
      { value: "ocean", label: "Ocean blue", priceDelta: 0 },
      { value: "gold", label: "Gold flakes", priceDelta: 19900 },
    ] },
  },
  FRAME_COLOUR,
  {
    key: "name_text", label: "Name to set in resin", type: "text", isRequired: false, isActive: true, groupName: "Personalise",
    config: { maxLength: 24, placeholder: "e.g. Aarav · 12.03.2026", priceDelta: 9900 },
  },
];
