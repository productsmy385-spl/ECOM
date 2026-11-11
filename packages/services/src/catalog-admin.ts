import {
  brands,
  categories,
  type DbOrTx,
  db,
  inventory,
  inventoryMovements,
  productAttributes,
  productImages,
  products,
  productVariants,
} from "@ecom/db";
import { can, canAny, requirePermission } from "@ecom/rbac";
import {
  adminProductListQuery,
  brandInputSchema,
  categoryInputSchema,
  type Paginated,
  productInputSchema,
  productStatusSchema,
  stockAdjustSchema,
} from "@ecom/validation";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { AuthorizationError, ConflictError, NotFoundError, uniqueViolation, ValidationError } from "./errors";
import { slugify, uniqueSlug } from "./slug";

const canSeeCatalog = (ctx: ServiceContext) =>
  canAny(ctx.actor, ["products.view", "products.update", "categories.manage"]);

// ================================================================ categories

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isCustomizable: boolean;
  sortOrder: number;
  productCount: number;
}

export async function listCategoriesAdmin(ctx: ServiceContext): Promise<AdminCategory[]> {
  if (!canSeeCatalog(ctx)) throw new AuthorizationError();
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
      description: categories.description,
      imageUrl: categories.imageUrl,
      isActive: categories.isActive,
      isFeatured: categories.isFeatured,
      isCustomizable: categories.isCustomizable,
      sortOrder: categories.sortOrder,
      productCount: sql<number>`(select count(*)::int from ${products} p where p.category_id = "categories"."id" and p.deleted_at is null)`,
    })
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return rows;
}

async function assertNoCycle(conn: DbOrTx, id: string, parentId: string | null) {
  let cursor = parentId;
  for (let depth = 0; cursor && depth < 20; depth++) {
    if (cursor === id) throw new ValidationError("A category can't be inside itself.", { parentId: ["Creates a loop"] });
    const [row] = await conn.select({ parentId: categories.parentId }).from(categories).where(eq(categories.id, cursor));
    cursor = row?.parentId ?? null;
  }
}

async function assertParent(conn: DbOrTx, parentId: string | null) {
  if (!parentId) return;
  const [p] = await conn
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, parentId), isNull(categories.deletedAt)));
  if (!p) throw new ValidationError("Parent category not found.", { parentId: ["Not found"] });
}

export async function createCategory(ctx: ServiceContext, raw: unknown): Promise<AdminCategory> {
  requirePermission(ctx.actor, "categories.manage");
  const input = categoryInputSchema.parse(raw);
  return db.transaction(async (tx) => {
    await assertParent(tx, input.parentId);
    const slug = input.slug ?? (await uniqueSlug(tx, categories, slugify(input.name)));
    try {
      const [row] = await tx
        .insert(categories)
        .values({ ...input, slug, description: input.description ?? null })
        .returning();
      await writeAudit(tx, ctx, { action: "category.create", entityType: "category", entityId: row!.id, after: { ...input, slug } });
      return { ...row!, productCount: 0 };
    } catch (err) {
      if (uniqueViolation(err)) throw new ConflictError("That URL slug is already used by another category.");
      throw err;
    }
  });
}

export async function updateCategory(ctx: ServiceContext, id: string, raw: unknown): Promise<AdminCategory> {
  requirePermission(ctx.actor, "categories.manage");
  const input = categoryInputSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(categories).where(and(eq(categories.id, id), isNull(categories.deletedAt)));
    if (!before) throw new NotFoundError("Category not found.");
    await assertParent(tx, input.parentId);
    await assertNoCycle(tx, id, input.parentId);
    const slug = input.slug ?? before.slug;
    try {
      const [row] = await tx
        .update(categories)
        .set({ ...input, slug, description: input.description ?? null })
        .where(eq(categories.id, id))
        .returning();
      await writeAudit(tx, ctx, { action: "category.update", entityType: "category", entityId: id, before, after: row });
      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(products)
        .where(and(eq(products.categoryId, id), isNull(products.deletedAt)));
      return { ...row!, productCount: n };
    } catch (err) {
      if (uniqueViolation(err)) throw new ConflictError("That URL slug is already used by another category.");
      throw err;
    }
  });
}

export async function deleteCategory(ctx: ServiceContext, id: string): Promise<void> {
  requirePermission(ctx.actor, "categories.manage");
  await db.transaction(async (tx) => {
    const [cat] = await tx.select().from(categories).where(and(eq(categories.id, id), isNull(categories.deletedAt)));
    if (!cat) throw new NotFoundError("Category not found.");
    const [{ n: productsIn } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.categoryId, id), isNull(products.deletedAt)));
    if (productsIn > 0) throw new ConflictError(`Move or delete its ${productsIn} product(s) first.`);
    const [{ n: children } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(categories)
      .where(and(eq(categories.parentId, id), isNull(categories.deletedAt)));
    if (children > 0) throw new ConflictError(`Move or delete its ${children} sub-categor${children === 1 ? "y" : "ies"} first.`);
    // Soft delete; free the slug for reuse.
    await tx
      .update(categories)
      .set({ deletedAt: new Date(), isActive: false, slug: `${cat.slug}--deleted-${Date.now()}` })
      .where(eq(categories.id, id));
    await writeAudit(tx, ctx, { action: "category.delete", entityType: "category", entityId: id, before: cat });
  });
}

// ==================================================================== brands

export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  productCount: number;
}

export async function listBrandsAdmin(ctx: ServiceContext): Promise<AdminBrand[]> {
  if (!canSeeCatalog(ctx)) throw new AuthorizationError();
  return db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      description: brands.description,
      logoUrl: brands.logoUrl,
      isActive: brands.isActive,
      isFeatured: brands.isFeatured,
      productCount: sql<number>`(select count(*)::int from ${products} p where p.brand_id = "brands"."id" and p.deleted_at is null)`,
    })
    .from(brands)
    .where(isNull(brands.deletedAt))
    .orderBy(asc(brands.name));
}

export async function createBrand(ctx: ServiceContext, raw: unknown): Promise<AdminBrand> {
  requirePermission(ctx.actor, "categories.manage");
  const input = brandInputSchema.parse(raw);
  return db.transaction(async (tx) => {
    const slug = input.slug ?? (await uniqueSlug(tx, brands, slugify(input.name)));
    try {
      const [row] = await tx.insert(brands).values({ ...input, slug, description: input.description ?? null }).returning();
      await writeAudit(tx, ctx, { action: "brand.create", entityType: "brand", entityId: row!.id, after: row });
      return { ...row!, productCount: 0 };
    } catch (err) {
      if (uniqueViolation(err)) throw new ConflictError("That URL slug is already used by another brand.");
      throw err;
    }
  });
}

export async function updateBrand(ctx: ServiceContext, id: string, raw: unknown): Promise<AdminBrand> {
  requirePermission(ctx.actor, "categories.manage");
  const input = brandInputSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(brands).where(and(eq(brands.id, id), isNull(brands.deletedAt)));
    if (!before) throw new NotFoundError("Brand not found.");
    try {
      const [row] = await tx
        .update(brands)
        .set({ ...input, slug: input.slug ?? before.slug, description: input.description ?? null })
        .where(eq(brands.id, id))
        .returning();
      await writeAudit(tx, ctx, { action: "brand.update", entityType: "brand", entityId: id, before, after: row });
      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(products)
        .where(and(eq(products.brandId, id), isNull(products.deletedAt)));
      return { ...row!, productCount: n };
    } catch (err) {
      if (uniqueViolation(err)) throw new ConflictError("That URL slug is already used by another brand.");
      throw err;
    }
  });
}

export async function deleteBrand(ctx: ServiceContext, id: string): Promise<void> {
  requirePermission(ctx.actor, "categories.manage");
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(brands).where(and(eq(brands.id, id), isNull(brands.deletedAt)));
    if (!b) throw new NotFoundError("Brand not found.");
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.brandId, id), isNull(products.deletedAt)));
    if (n > 0) throw new ConflictError(`Reassign its ${n} product(s) first.`);
    await tx
      .update(brands)
      .set({ deletedAt: new Date(), isActive: false, slug: `${b.slug}--deleted-${Date.now()}` })
      .where(eq(brands.id, id));
    await writeAudit(tx, ctx, { action: "brand.delete", entityType: "brand", entityId: id, before: b });
  });
}

// ================================================================== products

export interface AdminProductListItem {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  categoryName: string;
  brandName: string | null;
  imageUrl: string | null;
  variantCount: number;
  minPrice: number | null;
  stock: number;
  isCustomizable: boolean;
  updatedAt: Date;
}

export async function listProductsAdmin(ctx: ServiceContext, raw: unknown): Promise<Paginated<AdminProductListItem>> {
  requirePermission(ctx.actor, "products.view");
  const q = adminProductListQuery.parse(raw);
  const filters: SQL[] = [isNull(products.deletedAt)];
  if (q.status) filters.push(eq(products.status, q.status));
  if (q.categoryId) filters.push(eq(products.categoryId, q.categoryId));
  if (q.q) {
    const term = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(
      or(
        ilike(products.name, term),
        sql`exists (select 1 from ${productVariants} v where v.product_id = ${products.id} and v.sku ilike ${term})`,
      )!,
    );
  }
  const where = and(...filters);
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        status: products.status,
        categoryName: categories.name,
        brandName: brands.name,
        isCustomizable: products.isCustomizable,
        updatedAt: products.updatedAt,
        imageUrl: sql<string | null>`(select url from ${productImages} i where i.product_id = ${products.id} order by i.sort_order limit 1)`,
        variantCount: sql<number>`(select count(*)::int from ${productVariants} v where v.product_id = "products"."id" and v.deleted_at is null)`,
        minPrice: sql<number | null>`(select min(price) from ${productVariants} v where v.product_id = ${products.id} and v.deleted_at is null and v.is_active)`,
        stock: sql<number>`(select coalesce(sum(i.on_hand - i.reserved), 0)::int from ${inventory} i join ${productVariants} v on v.id = i.variant_id where v.product_id = "products"."id" and v.deleted_at is null)`,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(where)
      .orderBy(desc(products.updatedAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(products).where(where),
  ]);
  const total = totalRow?.n ?? 0;
  return { items: rows, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export interface AdminVariant {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  material: string | null;
  price: number;
  compareAtPrice: number | null;
  weightGrams: number | null;
  isDefault: boolean;
  isActive: boolean;
  onHand: number;
  reserved: number;
  minStock: number;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  categoryId: string;
  brandId: string | null;
  shortDescription: string | null;
  description: string | null;
  isCustomizable: boolean;
  requiresDesignReview: boolean;
  isFeatured: boolean;
  taxRateBps: number;
  hsnCode: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  variants: AdminVariant[];
  attributes: { groupName: string | null; name: string; value: string; isFilterable: boolean }[];
  images: { id: string; url: string; alt: string | null; imagekitFileId: string | null; variantSku: string | null }[];
}

async function loadProduct(conn: DbOrTx, id: string): Promise<AdminProduct> {
  const [p] = await conn.select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt)));
  if (!p) throw new NotFoundError("Product not found.");
  // Sequential on purpose: `conn` may be a transaction (one client), and pg
  // deprecates concurrent queries on a single client.
  const variants = await conn
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        barcode: productVariants.barcode,
        name: productVariants.name,
        color: productVariants.color,
        colorHex: productVariants.colorHex,
        size: productVariants.size,
        material: productVariants.material,
        price: productVariants.price,
        compareAtPrice: productVariants.compareAtPrice,
        weightGrams: productVariants.weightGrams,
        isDefault: productVariants.isDefault,
        isActive: productVariants.isActive,
        onHand: sql<number>`coalesce(${inventory.onHand}, 0)`,
        reserved: sql<number>`coalesce(${inventory.reserved}, 0)`,
        minStock: sql<number>`coalesce(${inventory.minStock}, 5)`,
      })
      .from(productVariants)
      .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(and(eq(productVariants.productId, id), isNull(productVariants.deletedAt)))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt));
  const attributes = await conn
      .select({
        groupName: productAttributes.groupName,
        name: productAttributes.name,
        value: productAttributes.value,
        isFilterable: productAttributes.isFilterable,
      })
      .from(productAttributes)
      .where(eq(productAttributes.productId, id))
      .orderBy(asc(productAttributes.sortOrder));
  const images = await conn
      .select({
        id: productImages.id,
        url: productImages.url,
        alt: productImages.alt,
        imagekitFileId: productImages.imagekitFileId,
        variantSku: productVariants.sku,
      })
      .from(productImages)
      .leftJoin(productVariants, eq(productVariants.id, productImages.variantId))
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.sortOrder));
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    categoryId: p.categoryId,
    brandId: p.brandId,
    shortDescription: p.shortDescription,
    description: p.description,
    isCustomizable: p.isCustomizable,
    requiresDesignReview: p.requiresDesignReview,
    isFeatured: p.isFeatured,
    taxRateBps: p.taxRateBps,
    hsnCode: p.hsnCode,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    variants: variants.map((v) => ({ ...v, onHand: Number(v.onHand), reserved: Number(v.reserved), minStock: Number(v.minStock) })),
    attributes,
    images,
  };
}

export async function getProductAdmin(ctx: ServiceContext, id: string): Promise<AdminProduct> {
  requirePermission(ctx.actor, "products.view");
  return loadProduct(db, id);
}

async function assertRefs(conn: DbOrTx, categoryId: string, brandId: string | null) {
  const [c] = await conn.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), isNull(categories.deletedAt)));
  if (!c) throw new ValidationError("Choose a valid category.", { categoryId: ["Not found"] });
  if (brandId) {
    const [b] = await conn.select({ id: brands.id }).from(brands).where(and(eq(brands.id, brandId), isNull(brands.deletedAt)));
    if (!b) throw new ValidationError("Choose a valid brand.", { brandId: ["Not found"] });
  }
}

type ParsedProduct = ReturnType<typeof productInputSchema.parse>;

/** Writes variants, attributes and images. Existing variants are matched by id. */
async function writeChildren(conn: DbOrTx, ctx: ServiceContext, productId: string, input: ParsedProduct, isCreate: boolean) {
  const anyDefault = input.variants.some((v) => v.isDefault);
  const keepIds: string[] = [];

  const existing = isCreate
    ? []
    : await conn
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.productId, productId), isNull(productVariants.deletedAt)));
  const existingIds = new Set(existing.map((e) => e.id));

  for (const [i, v] of input.variants.entries()) {
    const values = {
      sku: v.sku,
      barcode: v.barcode ?? null,
      name: v.name,
      color: v.color ?? null,
      colorHex: v.colorHex ?? null,
      size: v.size ?? null,
      material: v.material ?? null,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      weightGrams: v.weightGrams ?? null,
      isDefault: anyDefault ? v.isDefault : i === 0,
      isActive: v.isActive,
      sortOrder: i,
    };
    if (v.id) {
      if (!existingIds.has(v.id)) throw new ValidationError("A variant does not belong to this product.", { variants: ["Unknown variant"] });
      await conn.update(productVariants).set(values).where(eq(productVariants.id, v.id));
      keepIds.push(v.id);
      if (v.minStock !== undefined) {
        await conn.update(inventory).set({ minStock: v.minStock }).where(eq(inventory.variantId, v.id));
      }
    } else {
      const initial = v.initialStock ?? 0;
      if (initial > 0 && !can(ctx.actor, "inventory.manage")) {
        throw new AuthorizationError("Setting stock needs inventory permission. Save with 0 stock and ask an inventory manager.");
      }
      const [row] = await conn.insert(productVariants).values({ ...values, productId }).returning({ id: productVariants.id });
      keepIds.push(row!.id);
      await conn.insert(inventory).values({ variantId: row!.id, onHand: initial, minStock: v.minStock ?? 5 });
      if (initial > 0) {
        await conn.insert(inventoryMovements).values({
          variantId: row!.id,
          type: "adjustment",
          onHandDelta: initial,
          note: "Initial stock",
          referenceType: "product",
          referenceId: productId,
          actorId: ctx.actor.userId,
        });
      }
    }
  }

  // Variants removed from the form are soft-deleted (orders may reference them).
  if (!isCreate) {
    const removed = [...existingIds].filter((id) => !keepIds.includes(id));
    if (removed.length) {
      await conn
        .update(productVariants)
        .set({ deletedAt: new Date(), isActive: false, isDefault: false })
        .where(inArray(productVariants.id, removed));
    }
  }

  await conn.delete(productAttributes).where(eq(productAttributes.productId, productId));
  if (input.attributes.length) {
    await conn.insert(productAttributes).values(
      input.attributes.map((a, i) => ({
        productId,
        groupName: a.groupName ?? null,
        name: a.name,
        value: a.value,
        isFilterable: a.isFilterable,
        sortOrder: i,
      })),
    );
  }

  await conn.delete(productImages).where(eq(productImages.productId, productId));
  if (input.images.length) {
    const skuToId = new Map(
      (
        await conn
          .select({ id: productVariants.id, sku: productVariants.sku })
          .from(productVariants)
          .where(and(eq(productVariants.productId, productId), isNull(productVariants.deletedAt)))
      ).map((r) => [r.sku, r.id]),
    );
    await conn.insert(productImages).values(
      input.images.map((img, i) => ({
        productId,
        url: img.url,
        imagekitFileId: img.imagekitFileId ?? null,
        alt: img.alt ?? null,
        variantId: img.variantSku ? (skuToId.get(img.variantSku.toUpperCase()) ?? null) : null,
        sortOrder: i,
      })),
    );
  }
}

function skuConflict(err: unknown): never {
  const v = uniqueViolation(err);
  if (v?.constraint?.includes("sku")) throw new ConflictError("A SKU is already used by another product (SKUs can't be reused).");
  if (v?.constraint?.includes("barcode")) throw new ConflictError("A barcode is already used by another variant.");
  if (v?.constraint?.includes("slug")) throw new ConflictError("That URL slug is already used by another product.");
  throw err;
}

export async function createProduct(ctx: ServiceContext, raw: unknown): Promise<AdminProduct> {
  requirePermission(ctx.actor, "products.create");
  const input = productInputSchema.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      await assertRefs(tx, input.categoryId, input.brandId);
      const slug = input.slug ?? (await uniqueSlug(tx, products, slugify(input.name)));
      const [p] = await tx
        .insert(products)
        .values({
          name: input.name,
          slug,
          categoryId: input.categoryId,
          brandId: input.brandId,
          shortDescription: input.shortDescription ?? null,
          description: input.description ?? null,
          isCustomizable: input.isCustomizable,
          requiresDesignReview: input.requiresDesignReview,
          isFeatured: input.isFeatured,
          taxRateBps: input.taxRateBps,
          hsnCode: input.hsnCode ?? null,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          status: "draft",
        })
        .returning({ id: products.id });
      await writeChildren(tx, ctx, p!.id, input, true);
      const created = await loadProduct(tx, p!.id);
      await writeAudit(tx, ctx, {
        action: "product.create",
        entityType: "product",
        entityId: p!.id,
        after: { name: created.name, slug: created.slug, skus: created.variants.map((v) => v.sku) },
      });
      return created;
    });
  } catch (err) {
    return skuConflict(err);
  }
}

export async function updateProduct(ctx: ServiceContext, id: string, raw: unknown): Promise<AdminProduct> {
  requirePermission(ctx.actor, "products.update");
  const input = productInputSchema.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).for("update");
      const before = await loadProduct(tx, id);
      await assertRefs(tx, input.categoryId, input.brandId);
      await tx
        .update(products)
        .set({
          name: input.name,
          slug: input.slug ?? before.slug,
          categoryId: input.categoryId,
          brandId: input.brandId,
          shortDescription: input.shortDescription ?? null,
          description: input.description ?? null,
          isCustomizable: input.isCustomizable,
          requiresDesignReview: input.requiresDesignReview,
          isFeatured: input.isFeatured,
          taxRateBps: input.taxRateBps,
          hsnCode: input.hsnCode ?? null,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
        })
        .where(eq(products.id, id));
      await writeChildren(tx, ctx, id, input, false);
      const after = await loadProduct(tx, id);
      if (after.status === "published" && !after.variants.some((v) => v.isActive)) {
        throw new ValidationError("A published product needs at least one active variant. Unpublish it first.", {
          variants: ["No active variant"],
        });
      }
      await writeAudit(tx, ctx, {
        action: "product.update",
        entityType: "product",
        entityId: id,
        before: { name: before.name, slug: before.slug, prices: before.variants.map((v) => [v.sku, v.price]) },
        after: { name: after.name, slug: after.slug, prices: after.variants.map((v) => [v.sku, v.price]) },
      });
      return after;
    });
  } catch (err) {
    return skuConflict(err);
  }
}

export async function setProductStatus(ctx: ServiceContext, id: string, raw: unknown): Promise<AdminProduct> {
  requirePermission(ctx.actor, "products.publish");
  const { status } = productStatusSchema.parse(raw);
  return db.transaction(async (tx) => {
    const p = await loadProduct(tx, id);
    if (status === "published") {
      if (!p.variants.some((v) => v.isActive && v.price > 0)) {
        throw new ConflictError("Add at least one active variant with a price before publishing.");
      }
      const [cat] = await tx.select({ isActive: categories.isActive }).from(categories).where(eq(categories.id, p.categoryId));
      if (!cat?.isActive) throw new ConflictError("Its category is hidden. Activate the category first.");
    }
    await tx
      .update(products)
      .set({ status, publishedAt: status === "published" ? (p.publishedAt ?? new Date()) : p.publishedAt })
      .where(eq(products.id, id));
    await writeAudit(tx, ctx, { action: `product.${status === "published" ? "publish" : status === "draft" ? "unpublish" : "archive"}`, entityType: "product", entityId: id, before: { status: p.status }, after: { status } });
    return { ...p, status };
  });
}

export async function deleteProduct(ctx: ServiceContext, id: string): Promise<void> {
  requirePermission(ctx.actor, "products.delete");
  await db.transaction(async (tx) => {
    const p = await loadProduct(tx, id);
    // Soft delete: orders keep referencing it; the slug is freed for reuse.
    await tx
      .update(products)
      .set({ deletedAt: new Date(), status: "archived", slug: `${p.slug}--deleted-${Date.now()}` })
      .where(eq(products.id, id));
    await writeAudit(tx, ctx, { action: "product.delete", entityType: "product", entityId: id, before: { name: p.name, slug: p.slug } });
  });
}

/** Manual stock correction, recorded in the inventory ledger. */
export async function adjustStock(ctx: ServiceContext, variantId: string, raw: unknown) {
  requirePermission(ctx.actor, "inventory.manage");
  const { delta, note } = stockAdjustSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ onHand: inventory.onHand, reserved: inventory.reserved, productId: productVariants.productId, sku: productVariants.sku })
      .from(inventory)
      .innerJoin(productVariants, eq(productVariants.id, inventory.variantId))
      .where(and(eq(inventory.variantId, variantId), isNull(productVariants.deletedAt)))
      .for("update");
    if (!row) throw new NotFoundError("Variant not found.");
    const next = row.onHand + delta;
    if (next < row.reserved) {
      throw new ConflictError(`Can't go below ${row.reserved} units: they're reserved by open orders.`);
    }
    await tx.update(inventory).set({ onHand: next }).where(eq(inventory.variantId, variantId));
    await tx.insert(inventoryMovements).values({
      variantId,
      type: "adjustment",
      onHandDelta: delta,
      note,
      referenceType: "manual",
      actorId: ctx.actor.userId,
    });
    await writeAudit(tx, ctx, {
      action: "inventory.adjust",
      entityType: "variant",
      entityId: variantId,
      before: { onHand: row.onHand },
      after: { onHand: next, delta, note, sku: row.sku },
    });
    return { variantId, onHand: next, reserved: row.reserved };
  });
}

/** Options for admin product form selects. */
export async function catalogFormOptions(ctx: ServiceContext) {
  if (!canSeeCatalog(ctx)) throw new AuthorizationError();
  const [cats, brs] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, parentId: categories.parentId, isCustomizable: categories.isCustomizable })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ id: brands.id, name: brands.name }).from(brands).where(isNull(brands.deletedAt)).orderBy(asc(brands.name)),
  ]);
  return { categories: cats, brands: brs };
}
