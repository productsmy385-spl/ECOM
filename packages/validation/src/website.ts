/**
 * Website settings (Admin → Website settings): storefront template, layout,
 * homepage sections, announcement bar, contact & social links and SEO.
 * Stored as one JSON document in system_settings["website.settings"].
 * Template keys must match packages/ui/src/website-templates.ts (a test checks).
 */
import { z } from "zod";

export const WEBSITE_TEMPLATE_KEYS = ["adira-crimson", "rose-gold", "midnight-gold", "emerald", "royal-plum", "terracotta", "ocean", "monochrome"] as const;

export const HOME_SECTION_KEYS = ["services", "bestSellers", "offer", "collections", "categories", "customizable", "reviews", "brands"] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const HOME_SECTION_LABELS: Record<HomeSectionKey, string> = {
  services: "Why shop with us (4 promises)",
  bestSellers: "Best selling items",
  offer: "Offer banner",
  collections: "Featured · Latest · Best reviewed · On sale",
  categories: "Shop by category",
  customizable: "Make it yours (customisable frames)",
  reviews: "Customer reviews",
  brands: "Brands",
};

/** Text that may be empty. */
const plain = (max: number) => z.string().trim().max(max, `At most ${max} characters`).default("");
/** Our own path ("/shop?tag=new") or an https URL. */
const link = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || (/^\/(?!\/)[^\s]*$/.test(v)) || /^https:\/\/[^\s]+$/.test(v), "Use a path like /shop or a full https:// link")
  .default("");
const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Must start with https://")
  .default("");

export const websiteSettingsSchema = z
  .object({
    template: z.enum(WEBSITE_TEMPLATE_KEYS).default("adira-crimson"),
    heroStyle: z.enum(["split", "centered", "banner"]).default("split"),
    corners: z.enum(["rounded", "soft", "square"]).default("rounded"),
    headingFont: z.enum(["sora", "playfair"]).default("sora"),
    tagline: plain(160),
    announcement: z
      .object({ enabled: z.boolean().default(false), text: plain(140), href: link })
      .default({ enabled: false, text: "", href: "" })
      .refine((a) => !a.enabled || a.text.length > 0, { path: ["text"], message: "Write the announcement, or turn it off" }),
    sections: z
      .array(z.object({ key: z.enum(HOME_SECTION_KEYS), enabled: z.boolean() }))
      .default(HOME_SECTION_KEYS.map((key) => ({ key, enabled: true })))
      .refine((s) => new Set(s.map((x) => x.key)).size === s.length, "Each section can appear once"),
    contact: z
      .object({
        email: z.string().trim().max(254).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email").default(""),
        phone: z.string().trim().max(20).refine((v) => v === "" || /^\+?[\d\s-]{8,18}$/.test(v), "Enter a valid phone number").default(""),
        whatsapp: z.string().trim().max(20).refine((v) => v === "" || /^\+?[\d\s-]{8,18}$/.test(v), "Enter a valid WhatsApp number").default(""),
        address: plain(300),
        hours: plain(120),
      })
      .default({ email: "", phone: "", whatsapp: "", address: "", hours: "" }),
    social: z
      .object({ instagram: httpsUrl, facebook: httpsUrl, youtube: httpsUrl, pinterest: httpsUrl, x: httpsUrl })
      .default({ instagram: "", facebook: "", youtube: "", pinterest: "", x: "" }),
    seo: z.object({ title: plain(70), description: plain(160) }).default({ title: "", description: "" }),
  })
  .transform((s) => {
    // Sections missing from a saved document (e.g. added in a later release) are appended, enabled.
    const known = new Set(s.sections.map((x) => x.key));
    return { ...s, sections: [...s.sections, ...HOME_SECTION_KEYS.filter((k) => !known.has(k)).map((key) => ({ key, enabled: true }))] };
  });

export type WebsiteSettings = z.output<typeof websiteSettingsSchema>;
export type WebsiteSettingsInput = z.input<typeof websiteSettingsSchema>;

// ---------------- banners ----------------

const imagekitUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/ik\.imagekit\.io\//.test(v) || /^\/demo\/[\w.-]+$/.test(v), "Upload an image")
  .default("");
const optionalDate = z
  .union([z.literal(""), z.null(), z.iso.datetime({ offset: true })])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

export const bannerInputSchema = z
  .object({
    placement: z.enum(["hero", "promo", "category"]),
    title: z.string().trim().min(2, "Add a title").max(120),
    subtitle: plain(240),
    ctaLabel: plain(40),
    ctaHref: link,
    imageUrl: imagekitUrl,
    mobileImageUrl: imagekitUrl,
    startsAt: optionalDate,
    endsAt: optionalDate,
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
  })
  .refine((b) => !b.startsAt || !b.endsAt || b.endsAt > b.startsAt, { path: ["endsAt"], message: "Must be after the start" })
  .refine((b) => !b.ctaLabel || b.ctaHref, { path: ["ctaHref"], message: "Add where the button goes" });
export type BannerInput = z.output<typeof bannerInputSchema>;
