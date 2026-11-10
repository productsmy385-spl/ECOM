import { z } from "zod";
import { optionalText, pagination, text, uuid } from "./common";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens")
  .max(120);
const optionalSlug = z
  .union([z.literal(""), slug])
  .optional()
  .transform((v) => (v ? v : undefined));

/** Only ImageKit-hosted images are accepted (uploads go through signed ImageKit uploads). */
export const imageUrl = z
  .url("Enter a valid URL")
  .refine((u) => /^https:\/\/ik\.imagekit\.io\//.test(u), "Images must be uploaded to ImageKit");
const optionalImageUrl = z
  .union([z.literal(""), imageUrl])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

/** Money in paise (integer). */
const paise = z.coerce.number().int("Must be a whole number of paise").min(0).max(100_000_000);

// ------------------------------------------------------------- categories

export const categoryInputSchema = z.object({
  name: text(80, "Name"),
  slug: optionalSlug,
  parentId: uuid.nullable().optional().transform((v) => v ?? null),
  description: optionalText(1000),
  imageUrl: optionalImageUrl,
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isCustomizable: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

// ----------------------------------------------------------------- brands

export const brandInputSchema = z.object({
  name: text(80, "Name"),
  slug: optionalSlug,
  description: optionalText(1000),
  logoUrl: optionalImageUrl,
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});
export type BrandInput = z.input<typeof brandInputSchema>;

// --------------------------------------------------------------- products

export const variantInputSchema = z
  .object({
    /** Present when editing an existing variant. */
    id: uuid.optional(),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-_.]{1,63}$/, "SKU: 2–64 letters, numbers, - _ ."),
    barcode: optionalText(64),
    name: text(120, "Variant name"),
    color: optionalText(40),
    colorHex: z
      .union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #CF0F47")])
      .optional()
      .transform((v) => (v ? v.toUpperCase() : undefined)),
    size: optionalText(40),
    material: optionalText(60),
    price: paise.refine((v) => v > 0, "Price must be more than ₹0"),
    compareAtPrice: paise.nullable().optional().transform((v) => (v ? v : null)),
    weightGrams: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    /** Only used when creating a variant; later changes go through stock adjustments. */
    initialStock: z.coerce.number().int().min(0).max(1_000_000).optional(),
    minStock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((v) => v.compareAtPrice === null || v.compareAtPrice >= v.price, {
    path: ["compareAtPrice"],
    message: "MRP must be at least the selling price",
  });
export type VariantInput = z.input<typeof variantInputSchema>;

export const attributeInputSchema = z.object({
  groupName: optionalText(60),
  name: text(80, "Specification name"),
  value: text(500, "Value"),
  isFilterable: z.boolean().default(false),
});

export const productImageInputSchema = z.object({
  url: imageUrl,
  imagekitFileId: optionalText(120),
  alt: optionalText(200),
  variantSku: optionalText(64),
});

export const productInputSchema = z
  .object({
    name: text(160, "Product name"),
    slug: optionalSlug,
    categoryId: uuid,
    brandId: uuid.nullable().optional().transform((v) => v ?? null),
    shortDescription: optionalText(300),
    description: optionalText(10_000),
    isCustomizable: z.boolean().default(false),
    requiresDesignReview: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    taxRateBps: z.coerce.number().int().refine((v) => [0, 500, 1200, 1800, 2800].includes(v), "Choose a GST slab"),
    hsnCode: optionalText(16),
    seoTitle: optionalText(70),
    seoDescription: optionalText(170),
    variants: z.array(variantInputSchema).min(1, "Add at least one variant").max(100),
    attributes: z.array(attributeInputSchema).max(60).default([]),
    images: z.array(productImageInputSchema).max(20).default([]),
  })
  .superRefine((p, ctx) => {
    const skus = p.variants.map((v) => v.sku.trim().toUpperCase());
    const dup = skus.find((s, i) => skus.indexOf(s) !== i);
    if (dup) ctx.addIssue({ code: "custom", path: ["variants"], message: `SKU ${dup} is used twice` });
    if (p.requiresDesignReview && !p.isCustomizable) {
      ctx.addIssue({ code: "custom", path: ["requiresDesignReview"], message: "Only customizable products need design review" });
    }
  });
export type ProductInput = z.input<typeof productInputSchema>;

export const productStatusSchema = z.object({ status: z.enum(["draft", "published", "archived"]) });

export const stockAdjustSchema = z.object({
  /** Signed change to on-hand stock. */
  delta: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, "Change can't be zero"),
  note: text(200, "Reason"),
});

export const adminProductListQuery = pagination.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  categoryId: uuid.optional(),
});

// ------------------------------------------------------- public catalogue

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20) : []));

export const SORTS = ["relevance", "popular", "newest", "price_asc", "price_desc", "rating"] as const;
export type ShopSort = (typeof SORTS)[number];

export const shopQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(120).optional(),
  brand: csv,
  color: csv,
  size: csv,
  material: csv,
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  inStock: z.enum(["1"]).optional(),
  tag: z.enum(["new", "bestseller", "custom"]).optional(),
  sort: z.enum(SORTS).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
});
export type ShopQuery = z.infer<typeof shopQuery>;

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
});
