import { sql, type SQL } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, id, timestamps, ts } from "./_helpers";
import {
  customizationOptionType,
  inventoryMovementType,
  productStatus,
  purchaseStatus,
  reviewStatus,
} from "./enums";
import { users } from "./users";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const categories = pgTable(
  "categories",
  {
    id: id(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    /** Whether products in this category support customization by default. */
    isCustomizable: boolean("is_customizable").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: deletedAt(),
    ...timestamps(),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

export const brands = pgTable("brands", {
  id: id(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  logoUrl: text("logo_url"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  deletedAt: deletedAt(),
  ...timestamps(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    shortDescription: text("short_description"),
    description: text("description"),
    status: productStatus("status").notNull().default("draft"),
    isCustomizable: boolean("is_customizable").notNull().default(false),
    /** Customized orders of this product go through designer review before production. */
    requiresDesignReview: boolean("requires_design_review").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    /** GST rate in basis points (1800 = 18%). */
    taxRateBps: integer("tax_rate_bps").notNull().default(1800),
    hsnCode: varchar("hsn_code", { length: 16 }),
    /** Denormalised from reviews/orders for sorting; recalculated by services. */
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
    ratingCount: integer("rating_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: ts("published_at"),
    deletedAt: deletedAt(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('simple', coalesce(${products.name}, '')), 'A') || setweight(to_tsvector('simple', coalesce(${products.shortDescription}, '')), 'B') || setweight(to_tsvector('simple', coalesce(${products.description}, '')), 'C')`,
    ),
    ...timestamps(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_brand_idx").on(t.brandId),
    index("products_status_published_idx").on(t.status, t.publishedAt),
    index("products_search_idx").using("gin", t.searchVector),
    index("products_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Optional: image specific to one variant (e.g. a colour). */
    variantId: uuid("variant_id").references((): AnyPgColumn => productVariants.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    imagekitFileId: text("imagekit_file_id"),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId, t.sortOrder)],
);

/**
 * Every product has at least one variant; price, SKU and stock live here.
 * Filterable facets (colour/size/material) are columns so filters are indexable.
 */
export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }).notNull().unique(),
    barcode: varchar("barcode", { length: 64 }).unique(),
    name: text("name").notNull(),
    color: varchar("color", { length: 40 }),
    colorHex: varchar("color_hex", { length: 7 }),
    size: varchar("size", { length: 40 }),
    material: varchar("material", { length: 60 }),
    /** Selling price in paise. */
    price: integer("price").notNull(),
    /** MRP in paise (strike-through price). */
    compareAtPrice: integer("compare_at_price"),
    weightGrams: integer("weight_grams"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: deletedAt(),
    ...timestamps(),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    index("variants_facets_idx").on(t.color, t.size, t.material),
    index("variants_price_idx").on(t.price),
    check("variants_price_nonneg", sql`${t.price} >= 0`),
    check(
      "variants_compare_at_gte_price",
      sql`${t.compareAtPrice} is null or ${t.compareAtPrice} >= ${t.price}`,
    ),
  ],
);

/** Specifications and extra filter attributes (e.g. "Lens width: 52mm"). */
export const productAttributes = pgTable(
  "product_attributes",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupName: varchar("group_name", { length: 60 }),
    name: varchar("name", { length: 80 }).notNull(),
    value: text("value").notNull(),
    isFilterable: boolean("is_filterable").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("product_attributes_product_idx").on(t.productId),
    index("product_attributes_filter_idx").on(t.name, t.value),
  ],
);

/**
 * Admin-configured customization options for a product.
 * `config` shape depends on `type`, e.g. for select/color:
 *   { choices: [{ value, label, hex?, priceDelta (paise), imageUrl? }] }
 * for text: { maxLength, fonts?: string[], priceDelta }
 * for canvas: { width, height, printArea, allowedLayerTypes, fonts }
 * Validated by Zod in @ecom/validation before being stored.
 */
export const customizationOptions = pgTable(
  "customization_options",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    label: text("label").notNull(),
    helpText: text("help_text"),
    groupName: varchar("group_name", { length: 60 }),
    type: customizationOptionType("type").notNull(),
    isRequired: boolean("is_required").notNull().default(false),
    config: jsonb("config").notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("customization_options_product_key_uq").on(t.productId, t.key)],
);

/**
 * Stock per variant. available = on_hand - reserved.
 * CHECK constraints make overselling impossible even if application code is wrong:
 * a reservation that would push reserved above on_hand fails the transaction.
 */
export const inventory = pgTable(
  "inventory",
  {
    variantId: uuid("variant_id")
      .primaryKey()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    minStock: integer("min_stock").notNull().default(5),
    location: varchar("location", { length: 60 }),
    updatedAt: timestamps().updatedAt,
  },
  (t) => [
    check("inventory_on_hand_nonneg", sql`${t.onHand} >= 0`),
    check("inventory_reserved_nonneg", sql`${t.reserved} >= 0`),
    check("inventory_reserved_lte_on_hand", sql`${t.reserved} <= ${t.onHand}`),
  ],
);

/** Append-only stock ledger. */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: id(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    type: inventoryMovementType("type").notNull(),
    /** Signed change applied to on_hand. */
    onHandDelta: integer("on_hand_delta").notNull().default(0),
    /** Signed change applied to reserved. */
    reservedDelta: integer("reserved_delta").notNull().default(0),
    referenceType: varchar("reference_type", { length: 32 }),
    referenceId: uuid("reference_id"),
    note: text("note"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("inventory_movements_variant_idx").on(t.variantId, t.createdAt),
    index("inventory_movements_ref_idx").on(t.referenceType, t.referenceId),
  ],
);

export const suppliers = pgTable("suppliers", {
  id: id(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: varchar("phone", { length: 20 }),
  gstin: varchar("gstin", { length: 15 }),
  address: text("address"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: deletedAt(),
  ...timestamps(),
});

export const purchases = pgTable(
  "purchases",
  {
    id: id(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    reference: varchar("reference", { length: 64 }).notNull().unique(),
    status: purchaseStatus("status").notNull().default("draft"),
    /** Total cost in paise. */
    totalCost: integer("total_cost").notNull().default(0),
    notes: text("notes"),
    orderedAt: ts("ordered_at"),
    receivedAt: ts("received_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("purchases_supplier_idx").on(t.supplierId)],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: id(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    /** Unit cost in paise. */
    unitCost: integer("unit_cost").notNull(),
  },
  (t) => [
    index("purchase_items_purchase_idx").on(t.purchaseId),
    check("purchase_items_qty_pos", sql`${t.quantity} > 0`),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Set when the review comes from a delivered order (verified purchase). */
    orderItemId: uuid("order_item_id"),
    rating: smallint("rating").notNull(),
    title: text("title"),
    body: text("body"),
    status: reviewStatus("status").notNull().default("pending"),
    moderatedBy: uuid("moderated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("reviews_user_product_uq").on(t.userId, t.productId),
    index("reviews_product_status_idx").on(t.productId, t.status),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);
