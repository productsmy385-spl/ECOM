/**
 * Storefront templates (Admin → Website settings). A template is a complete
 * colour theme plus default layout choices. "Adira Crimson" is the brand
 * default; the others are opt-in alternatives the owner can switch to.
 *
 * Contrast is checked for each palette (WCAG AA): white text on `primary`
 * and on `primaryHover` ≥ 4.5:1; `ink` on `soft` ≥ 7:1. Only these vetted
 * values ever reach the page — admins pick a key, never a raw colour.
 */
export type HeroStyle = "split" | "centered" | "banner";
export type CornerStyle = "rounded" | "soft" | "square";
export type HeadingFont = "sora" | "playfair";

export interface WebsiteTemplate {
  key: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    primaryHover: string;
    highlight: string;
    /** Section backgrounds (Bookly's "blush" surfaces). */
    soft: string;
    softer: string;
    ring: string;
    /** rgb triplet for the product-card glow. */
    glow: string;
  };
  defaults: { heroStyle: HeroStyle; corners: CornerStyle; headingFont: HeadingFont };
}

export const WEBSITE_TEMPLATES = [
  {
    key: "adira-crimson",
    name: "Adira Crimson",
    description: "The brand look: crimson and blush, rounded and warm.",
    colors: { primary: "#cf0f47", primaryHover: "#a80c3a", highlight: "#ff0b55", soft: "#ffdede", softer: "#fff5f5", ring: "#ff0b55", glow: "207 15 71" },
    defaults: { heroStyle: "split", corners: "rounded", headingFont: "sora" },
  },
  {
    key: "rose-gold",
    name: "Rose Gold",
    description: "Dusty rose with champagne surfaces, for weddings and gifting.",
    colors: { primary: "#9e4f5c", primaryHover: "#843f4b", highlight: "#d4a373", soft: "#f6e3df", softer: "#fcf6f4", ring: "#d4a373", glow: "158 79 92" },
    defaults: { heroStyle: "centered", corners: "rounded", headingFont: "playfair" },
  },
  {
    key: "midnight-gold",
    name: "Midnight Gold",
    description: "Deep navy and antique gold. Premium and gallery-like.",
    colors: { primary: "#1f2a44", primaryHover: "#141c2f", highlight: "#c9a227", soft: "#e9edf5", softer: "#f6f8fb", ring: "#c9a227", glow: "31 42 68" },
    defaults: { heroStyle: "banner", corners: "soft", headingFont: "playfair" },
  },
  {
    key: "emerald",
    name: "Emerald Garden",
    description: "Fresh green for pressed-flower and botanical resin art.",
    colors: { primary: "#0f6b4f", primaryHover: "#0b543e", highlight: "#e0a526", soft: "#dff1e9", softer: "#f3faf6", ring: "#e0a526", glow: "15 107 79" },
    defaults: { heroStyle: "split", corners: "rounded", headingFont: "sora" },
  },
  {
    key: "royal-plum",
    name: "Royal Plum",
    description: "Rich purple with lilac surfaces. Festive and bold.",
    colors: { primary: "#6b2c91", primaryHover: "#561f77", highlight: "#e86fae", soft: "#efe3f7", softer: "#faf5fd", ring: "#e86fae", glow: "107 44 145" },
    defaults: { heroStyle: "centered", corners: "rounded", headingFont: "sora" },
  },
  {
    key: "terracotta",
    name: "Terracotta",
    description: "Earthy clay and sand, handmade and rustic.",
    colors: { primary: "#a8432a", primaryHover: "#8a3520", highlight: "#e9a03b", soft: "#f8e6dc", softer: "#fdf7f3", ring: "#e9a03b", glow: "168 67 42" },
    defaults: { heroStyle: "split", corners: "soft", headingFont: "playfair" },
  },
  {
    key: "ocean",
    name: "Ocean Blue",
    description: "Calm teal-blue, clean and modern.",
    colors: { primary: "#0b5f86", primaryHover: "#084a69", highlight: "#2bb3c0", soft: "#dceff7", softer: "#f2f9fc", ring: "#2bb3c0", glow: "11 95 134" },
    defaults: { heroStyle: "banner", corners: "soft", headingFont: "sora" },
  },
  {
    key: "monochrome",
    name: "Monochrome",
    description: "Black and white with a crimson accent. Minimal and editorial.",
    colors: { primary: "#111111", primaryHover: "#333333", highlight: "#cf0f47", soft: "#efefef", softer: "#f8f8f8", ring: "#cf0f47", glow: "0 0 0" },
    defaults: { heroStyle: "centered", corners: "square", headingFont: "sora" },
  },
] as const satisfies readonly WebsiteTemplate[];

export type WebsiteTemplateKey = (typeof WEBSITE_TEMPLATES)[number]["key"];
export const WEBSITE_TEMPLATE_KEYS = WEBSITE_TEMPLATES.map((t) => t.key) as [WebsiteTemplateKey, ...WebsiteTemplateKey[]];
export const DEFAULT_TEMPLATE: WebsiteTemplateKey = "adira-crimson";

export function getTemplate(key: string): WebsiteTemplate {
  return WEBSITE_TEMPLATES.find((t) => t.key === key) ?? WEBSITE_TEMPLATES[0];
}

const RADII: Record<CornerStyle, { xl: string; x2: string; media: string; pill: string }> = {
  rounded: { xl: "0.75rem", x2: "1rem", media: "2rem", pill: "9999px" },
  soft: { xl: "0.5rem", x2: "0.625rem", media: "1rem", pill: "0.75rem" },
  square: { xl: "0.125rem", x2: "0.125rem", media: "0.25rem", pill: "0.25rem" },
};

/** CSS custom properties for the storefront's <html> (values come only from the vetted lists above). */
export function templateCssVars(key: string, corners: CornerStyle, headingFont: HeadingFont): Record<string, string> {
  const t = getTemplate(key).colors;
  const r = RADII[corners] ?? RADII.rounded;
  return {
    "--primary": t.primary,
    "--primary-hover": t.primaryHover,
    "--link": t.primary,
    "--highlight": t.highlight,
    "--ring": t.ring,
    "--accent": t.soft,
    "--surface-tint": t.softer,
    "--blush": t.soft,
    "--blush-50": t.softer,
    "--glow": t.glow,
    "--radius-card": r.xl,
    "--radius-card-lg": r.x2,
    "--radius-media": r.media,
    "--radius-pill": r.pill,
    "--font-heading": headingFont === "playfair" ? "var(--font-playfair), Georgia, serif" : "var(--font-sora), ui-sans-serif, system-ui, sans-serif",
  };
}
