/**
 * Catalogue: admin rules (permissions, slugs, SKUs, stock ledger, publish rules,
 * soft delete) and public reads (visibility, search, filters, facets, sorting).
 */
import { loadActor } from "@ecom/auth";
import {
  brands,
  categories,
  db,
  inventory,
  inventoryMovements,
  newsletterSubscribers,
  products,
  productVariants,
  roles,
  rolePermissions,
  permissions,
  userRoles,
  users,
} from "@ecom/db";
import { type Actor, AuthorizationError } from "@ecom/rbac";
import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adjustStock,
  ConflictError,
  createBrand,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getProductBySlug,
  searchCatalog,
  setProductStatus,
  subscribeNewsletter,
  suggest,
  updateCategory,
  updateProduct,
  ValidationError,
} from "./index";

const run = `c${Date.now().toString(36)}`;
const ctxOf = async (id: string) => ({ actor: (await loadActor(id)) as Actor });
let root: string;
let manager: string;
let creatorNoStock: string;
let catId: string;
let childCatId: string;
let brandId: string;

async function user(name: string, roleKey: string) {
  const [u] = await db.insert(users).values({ name, email: `${name}.${run}@example.test`, isStaff: true }).returning({ id: users.id });
  const [r] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, roleKey));
  await db.insert(userRoles).values({ userId: u!.id, roleId: r!.id });
  return u!.id;
}

const variant = (sku: string, price: number, extra: Record<string, unknown> = {}) => ({
  sku: `${run}-${sku}`.toUpperCase(),
  name: sku,
  price,
  ...extra,
});

beforeAll(async () => {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  root = r!.id;
  manager = await user("mgr", "manager");

  // A custom role that may create products but not manage stock.
  const [role] = await db.insert(roles).values({ key: `creator_${run}`, name: `Creator ${run}` }).returning({ id: roles.id });
  const perms = await db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.key, ["products.create", "products.view"]));
  await db.insert(rolePermissions).values(perms.map((p) => ({ roleId: role!.id, permissionId: p.id })));
  creatorNoStock = await user("creator", `creator_${run}`);

  const ctx = await ctxOf(root);
  catId = (await createCategory(ctx, { name: `Frames ${run}` })).id;
  childCatId = (await createCategory(ctx, { name: `Aviators ${run}`, parentId: catId })).id;
  brandId = (await createBrand(ctx, { name: `Lumen ${run}` })).id;
});

afterAll(async () => {
  const prods = await db.select({ id: products.id }).from(products).where(like(products.name, `%${run}%`));
  if (prods.length) {
    const ids = prods.map((p) => p.id);
    const vs = await db.select({ id: productVariants.id }).from(productVariants).where(inArray(productVariants.productId, ids));
    if (vs.length) await db.delete(inventoryMovements).where(inArray(inventoryMovements.variantId, vs.map((v) => v.id)));
    await db.delete(products).where(inArray(products.id, ids));
  }
  await db.delete(categories).where(like(categories.name, `%${run}%`));
  await db.delete(brands).where(like(brands.name, `%${run}%`));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
  await db.delete(roles).where(eq(roles.key, `creator_${run}`));
  await db.delete(newsletterSubscribers).where(like(newsletterSubscribers.email, `%${run}%`));
});

describe("categories", () => {
  it("generates unique slugs and prevents parent loops", async () => {
    const ctx = await ctxOf(root);
    const dup = await createCategory(ctx, { name: `Frames ${run}` });
    expect(dup.slug).toBe(`frames-${run}-2`);
    await expect(updateCategory(ctx, catId, { name: `Frames ${run}`, parentId: childCatId })).rejects.toBeInstanceOf(ValidationError);
    await deleteCategory(ctx, dup.id);
  });

  it("needs categories.manage", async () => {
    await expect(createCategory(await ctxOf(manager), { name: `X ${run}` })).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("products (admin)", () => {
  let productId: string;
  let slug: string;

  it("creates a draft with variants, initial stock and a ledger entry", async () => {
    const p = await createProduct(await ctxOf(root), {
      name: `Aviator Classic ${run}`,
      categoryId: childCatId,
      brandId,
      shortDescription: "Gold metal aviator",
      taxRateBps: 1200,
      variants: [
        variant("gold-m", 249900, { color: "Gold", colorHex: "#d4af37", size: "M", material: "Metal", compareAtPrice: 349900, initialStock: 10 }),
        variant("black-l", 199900, { color: "Black", colorHex: "#000000", size: "L", material: "Acetate", initialStock: 0 }),
      ],
      attributes: [{ name: "Lens width", value: "54 mm", isFilterable: true }],
    });
    productId = p.id;
    slug = p.slug;
    expect(p.status).toBe("draft");
    expect(p.variants).toHaveLength(2);
    expect(p.variants.filter((v) => v.isDefault)).toHaveLength(1);
    expect(p.variants.find((v) => v.sku.endsWith("GOLD-M"))?.onHand).toBe(10);
    const ledger = await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.variantId, p.variants.find((v) => v.sku.endsWith("GOLD-M"))!.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.onHandDelta).toBe(10);
  });

  it("drafts are invisible to the storefront", async () => {
    expect(await getProductBySlug(slug)).toBeNull();
    const res = await searchCatalog({ q: `Aviator Classic ${run}` });
    expect(res.items.map((i) => i.id)).not.toContain(productId);
  });

  it("rejects duplicate SKUs across products", async () => {
    await expect(
      createProduct(await ctxOf(root), { name: `Dup ${run}`, categoryId: catId, taxRateBps: 1800, variants: [variant("gold-m", 1000)] }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("setting stock needs inventory permission; plain creation does not", async () => {
    const ctx = await ctxOf(creatorNoStock);
    await expect(
      createProduct(ctx, { name: `NoStock ${run}`, categoryId: catId, taxRateBps: 1800, variants: [variant("ns-1", 1000, { initialStock: 5 })] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    const ok = await createProduct(ctx, { name: `NoStock ${run}`, categoryId: catId, taxRateBps: 1800, variants: [variant("ns-2", 1000)] });
    expect(ok.variants[0]!.onHand).toBe(0);
  });

  it("a manager (view only) cannot create or publish", async () => {
    const ctx = await ctxOf(manager);
    await expect(
      createProduct(ctx, { name: `M ${run}`, categoryId: catId, taxRateBps: 1800, variants: [variant("m-1", 1000)] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(setProductStatus(ctx, productId, { status: "published" })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("publishing makes it visible with coarse availability only", async () => {
    await setProductStatus(await ctxOf(root), productId, { status: "published" });
    const d = await getProductBySlug(slug);
    expect(d?.name).toBe(`Aviator Classic ${run}`);
    expect(d?.brand?.name).toBe(`Lumen ${run}`);
    const gold = d!.variants.find((v) => v.sku.endsWith("GOLD-M"))!;
    expect(gold.availability).toBe("in_stock");
    expect(d!.variants.find((v) => v.sku.endsWith("BLACK-L"))!.availability).toBe("out_of_stock");
    expect(gold).not.toHaveProperty("onHand");
    expect(d!.specs).toEqual([{ group: null, name: "Lens width", value: "54 mm" }]);
  });

  it("stock adjustments are ledgered and cannot drop below reserved", async () => {
    const ctx = await ctxOf(root);
    const d = await getProductBySlug(slug);
    const goldId = d!.variants.find((v) => v.sku.endsWith("GOLD-M"))!.id;
    await db.update(inventory).set({ reserved: 4 }).where(eq(inventory.variantId, goldId));
    await expect(adjustStock(ctx, goldId, { delta: -7, note: "Damaged" })).rejects.toBeInstanceOf(ConflictError);
    const ok = await adjustStock(ctx, goldId, { delta: -6, note: "Damaged in transit" });
    expect(ok.onHand).toBe(4);
    await db.update(inventory).set({ reserved: 0 }).where(eq(inventory.variantId, goldId));
    await adjustStock(ctx, goldId, { delta: 6, note: "Restock" });
    await expect(adjustStock(await ctxOf(manager), goldId, { delta: 1, note: "x" })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("removing a variant soft-deletes it and hides it publicly", async () => {
    const ctx = await ctxOf(root);
    const current = await getProductBySlug(slug);
    const gold = current!.variants.find((v) => v.sku.endsWith("GOLD-M"))!;
    await updateProduct(ctx, productId, {
      name: `Aviator Classic ${run}`,
      categoryId: childCatId,
      brandId,
      taxRateBps: 1200,
      variants: [{ id: gold.id, sku: gold.sku, name: "Gold M", price: 239900, compareAtPrice: 349900, color: "Gold", colorHex: "#D4AF37", size: "M", material: "Metal" }],
    });
    const after = await getProductBySlug(slug);
    expect(after!.variants).toHaveLength(1);
    expect(after!.variants[0]!.price).toBe(239900);
    const [black] = await db.select().from(productVariants).where(like(productVariants.sku, `%${run.toUpperCase()}-BLACK-L`));
    expect(black?.deletedAt).not.toBeNull();
  });
});

describe("storefront search and filters", () => {
  beforeAll(async () => {
    const ctx = await ctxOf(root);
    const make = async (name: string, cat: string, price: number, color: string, stock: number) => {
      const p = await createProduct(ctx, {
        name: `${name} ${run}`,
        categoryId: cat,
        brandId,
        taxRateBps: 1800,
        variants: [variant(name.toLowerCase().replace(/\W+/g, "-"), price, { color, colorHex: "#111111", initialStock: stock })],
      });
      await setProductStatus(ctx, p.id, { status: "published" });
    };
    await make("Round Wire", catId, 99900, "Silver", 3);
    await make("Cat Eye Bold", catId, 459900, "Red", 0);
  });

  it("a parent category includes products from its sub-categories", async () => {
    const [parent] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, catId));
    const res = await searchCatalog({ category: parent!.slug });
    expect(res.items.map((i) => i.name)).toEqual(expect.arrayContaining([`Aviator Classic ${run}`, `Round Wire ${run}`, `Cat Eye Bold ${run}`]));
    expect(res.category?.slug).toBe(parent!.slug);
  });

  it("filters by colour, price range (rupees) and stock", async () => {
    const [parent] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, catId));
    const red = await searchCatalog({ category: parent!.slug, color: "red" });
    expect(red.items.map((i) => i.name)).toEqual([`Cat Eye Bold ${run}`]);
    const cheap = await searchCatalog({ category: parent!.slug, maxPrice: "1000" });
    expect(cheap.items.map((i) => i.name)).toEqual([`Round Wire ${run}`]);
    const inStock = await searchCatalog({ category: parent!.slug, inStock: "1" });
    expect(inStock.items.map((i) => i.name)).not.toContain(`Cat Eye Bold ${run}`);
  });

  it("sorts by price", async () => {
    const [parent] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, catId));
    const asc = await searchCatalog({ category: parent!.slug, sort: "price_asc" });
    const prices = asc.items.map((i) => i.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("finds products by brand, colour words and typos", async () => {
    expect((await searchCatalog({ q: `Lumen ${run}` })).total).toBeGreaterThanOrEqual(3);
    const typo = await searchCatalog({ q: `Aviatr Clasic ${run}` });
    expect(typo.items.map((i) => i.name)).toContain(`Aviator Classic ${run}`);
    // A single misspelled word must still match a long product name (word similarity).
    const single = await searchCatalog({ q: "aviatr", category: (await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, catId)))[0]!.slug });
    expect(single.items.map((i) => i.name)).toContain(`Aviator Classic ${run}`);
  });

  it("returns facets for the current scope", async () => {
    const [parent] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, catId));
    const res = await searchCatalog({ category: parent!.slug });
    expect(res.facets.brands.map((b) => b.name)).toContain(`Lumen ${run}`);
    expect(res.facets.colors.map((c) => c.name)).toEqual(expect.arrayContaining(["Gold", "Red", "Silver"]));
    expect(res.facets.priceRange?.min).toBe(99900);
  });

  it("suggests products, categories and brands", async () => {
    const s = await suggest(`Round Wire ${run}`);
    expect(s.products[0]?.name).toBe(`Round Wire ${run}`);
    expect((await suggest(`Lumen ${run}`)).brands[0]?.name).toBe(`Lumen ${run}`);
  });

  it("deleted products disappear and free their slug", async () => {
    const [row] = await db.select({ id: products.id, slug: products.slug }).from(products).where(eq(products.name, `Round Wire ${run}`));
    await deleteProduct(await ctxOf(root), row!.id);
    expect(await getProductBySlug(row!.slug)).toBeNull();
    const [after] = await db.select({ slug: products.slug }).from(products).where(eq(products.id, row!.id));
    expect(after!.slug).not.toBe(row!.slug);
  });

  it("a category with products cannot be deleted", async () => {
    await expect(deleteCategory(await ctxOf(root), childCatId)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("newsletter", () => {
  it("is idempotent and case-insensitive", async () => {
    await subscribeNewsletter({ email: `News.${run}@Example.test` });
    await subscribeNewsletter({ email: `news.${run}@example.test` });
    const rows = await db.select().from(newsletterSubscribers).where(sql`lower(email) = ${`news.${run}@example.test`}`);
    expect(rows).toHaveLength(1);
  });
});
