/**
 * Customer account services. Every function takes the customer id from the
 * VERIFIED session (never request input) and only touches that customer's
 * rows; anything else is reported as 404 (IDOR-safe).
 */
import {
  addresses,
  customerDesigns,
  customerProfiles,
  type DbOrTx,
  db,
  productImages,
  products,
  productVariants,
  sessions,
  users,
  wishlistItems,
  wishlists,
} from "@ecom/db";
import { addressSchema, profileSchema, wishlistSchema } from "@ecom/validation";
import { and, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { ConflictError, NotFoundError } from "./errors";

const MAX_ADDRESSES = 20;
const MAX_WISHLIST = 200;

export interface CustomerContext {
  userId: string;
}

// ================================================================= profile

export async function getProfile(c: CustomerContext) {
  const [u] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      phone: users.phone,
      createdAt: users.createdAt,
      dateOfBirth: customerProfiles.dateOfBirth,
      marketingOptIn: customerProfiles.marketingOptIn,
    })
    .from(users)
    .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .where(and(eq(users.id, c.userId), isNull(users.deletedAt)));
  if (!u) throw new NotFoundError("Account not found.");
  return { ...u, marketingOptIn: u.marketingOptIn ?? false };
}

export async function updateProfile(c: CustomerContext, raw: unknown) {
  const input = profileSchema.parse(raw);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: input.name, phone: input.phone }).where(eq(users.id, c.userId));
    await tx
      .insert(customerProfiles)
      .values({ userId: c.userId, dateOfBirth: input.dateOfBirth, marketingOptIn: input.marketingOptIn })
      .onConflictDoUpdate({ target: customerProfiles.userId, set: { dateOfBirth: input.dateOfBirth, marketingOptIn: input.marketingOptIn } });
  });
  return getProfile(c);
}

/** Active sign-ins for "devices" (no token values are ever returned). */
export async function listSessions(c: CustomerContext) {
  return db
    .select({ id: sessions.id, createdAt: sessions.createdAt, updatedAt: sessions.updatedAt, userAgent: sessions.userAgent, ipAddress: sessions.ipAddress })
    .from(sessions)
    .where(and(eq(sessions.userId, c.userId), sql`${sessions.expiresAt} > now()`))
    .orderBy(desc(sessions.updatedAt));
}

// =============================================================== addresses

const addressCols = {
  id: addresses.id,
  label: addresses.label,
  fullName: addresses.fullName,
  phone: addresses.phone,
  line1: addresses.line1,
  line2: addresses.line2,
  landmark: addresses.landmark,
  city: addresses.city,
  state: addresses.state,
  postalCode: addresses.postalCode,
  country: addresses.country,
  isDefault: addresses.isDefault,
};

export function listAddresses(c: CustomerContext) {
  return db
    .select(addressCols)
    .from(addresses)
    .where(and(eq(addresses.userId, c.userId), isNull(addresses.deletedAt)))
    .orderBy(desc(addresses.isDefault), desc(addresses.updatedAt));
}

async function ownAddress(conn: DbOrTx, c: CustomerContext, id: string) {
  const [a] = await conn
    .select({ id: addresses.id, isDefault: addresses.isDefault })
    .from(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, c.userId), isNull(addresses.deletedAt)))
    .for("update");
  if (!a) throw new NotFoundError("Address not found.");
  return a;
}

/** Clears the current default (the partial unique index allows only one). */
async function clearDefault(conn: DbOrTx, c: CustomerContext, exceptId?: string) {
  await conn
    .update(addresses)
    .set({ isDefault: false })
    .where(and(eq(addresses.userId, c.userId), eq(addresses.isDefault, true), exceptId ? ne(addresses.id, exceptId) : undefined));
}

export async function createAddress(c: CustomerContext, raw: unknown) {
  const input = addressSchema.parse(raw);
  return db.transaction(async (tx) => {
    // Serialise per customer so the count and default logic can't race.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, c.userId)).for("update");
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(addresses).where(and(eq(addresses.userId, c.userId), isNull(addresses.deletedAt)));
    if (n >= MAX_ADDRESSES) throw new ConflictError(`You can save up to ${MAX_ADDRESSES} addresses.`);
    const makeDefault = input.isDefault || n === 0; // first address is the default
    if (makeDefault) await clearDefault(tx, c);
    const [a] = await tx.insert(addresses).values({ ...input, userId: c.userId, isDefault: makeDefault }).returning(addressCols);
    return a!;
  });
}

export async function updateAddress(c: CustomerContext, id: string, raw: unknown) {
  const input = addressSchema.parse(raw);
  return db.transaction(async (tx) => {
    const cur = await ownAddress(tx, c, id);
    // A default can only be moved, not removed: unset by choosing another default.
    const isDefault = input.isDefault || cur.isDefault;
    if (isDefault) await clearDefault(tx, c, id);
    const [a] = await tx.update(addresses).set({ ...input, isDefault }).where(eq(addresses.id, id)).returning(addressCols);
    return a!;
  });
}

export async function setDefaultAddress(c: CustomerContext, id: string) {
  return db.transaction(async (tx) => {
    await ownAddress(tx, c, id);
    await clearDefault(tx, c, id);
    const [a] = await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, id)).returning(addressCols);
    return a!;
  });
}

/** Soft delete (orders keep their own address snapshot). Promotes another default if needed. */
export async function deleteAddress(c: CustomerContext, id: string) {
  await db.transaction(async (tx) => {
    const cur = await ownAddress(tx, c, id);
    await tx.update(addresses).set({ deletedAt: new Date(), isDefault: false }).where(eq(addresses.id, id));
    if (cur.isDefault) {
      const [next] = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(and(eq(addresses.userId, c.userId), isNull(addresses.deletedAt)))
        .orderBy(desc(addresses.updatedAt))
        .limit(1);
      if (next) await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
    }
  });
}

// ================================================================ wishlist

async function wishlistId(conn: DbOrTx, c: CustomerContext): Promise<string> {
  const [w] = await conn
    .insert(wishlists)
    .values({ userId: c.userId })
    .onConflictDoUpdate({ target: wishlists.userId, set: { updatedAt: new Date() } })
    .returning({ id: wishlists.id });
  return w!.id;
}

/** Product ids on the wishlist (for heart buttons). */
export async function wishlistProductIds(c: CustomerContext): Promise<string[]> {
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
    .where(eq(wishlists.userId, c.userId));
  return rows.map((r) => r.productId);
}

export async function listWishlist(c: CustomerContext) {
  const rows = await db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      status: products.status,
      deletedAt: products.deletedAt,
      addedAt: wishlistItems.createdAt,
      imageUrl: sql<string | null>`(select url from ${productImages} i where i.product_id = ${products.id} order by i.sort_order limit 1)`,
      price: sql<number | null>`(select min(price) from ${productVariants} v where v.product_id = ${products.id} and v.is_active and v.deleted_at is null)`,
      inStock: sql<boolean>`exists (select 1 from ${productVariants} v join inventory i on i.variant_id = v.id where v.product_id = ${products.id} and v.is_active and v.deleted_at is null and i.on_hand - i.reserved > 0)`,
    })
    .from(wishlistItems)
    .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .where(eq(wishlists.userId, c.userId))
    .orderBy(desc(wishlistItems.createdAt));
  return rows.map(({ status, deletedAt, ...r }) => ({
    ...r,
    price: r.price === null ? null : Number(r.price),
    // Unpublished/deleted products stay listed but can't be opened.
    available: status === "published" && !deletedAt,
  }));
}

export async function addToWishlist(c: CustomerContext, raw: unknown) {
  const { productId } = wishlistSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.status, "published"), isNull(products.deletedAt)));
    if (!p) throw new NotFoundError("Product not found.");
    const wid = await wishlistId(tx, c);
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(wishlistItems).where(eq(wishlistItems.wishlistId, wid));
    if (n >= MAX_WISHLIST) throw new ConflictError(`Your wishlist is full (${MAX_WISHLIST} items).`);
    await tx.insert(wishlistItems).values({ wishlistId: wid, productId }).onConflictDoNothing();
    return { productId, saved: true };
  });
}

export async function removeFromWishlist(c: CustomerContext, raw: unknown) {
  const { productId } = wishlistSchema.parse(raw);
  await db.execute(sql`delete from ${wishlistItems} wi using ${wishlists} w
                       where wi.wishlist_id = w.id and w.user_id = ${c.userId} and wi.product_id = ${productId}`);
  return { productId, saved: false };
}

// ================================================================ overview

export async function accountOverview(c: CustomerContext) {
  const [profile, [addr], [wish], [des]] = await Promise.all([
    getProfile(c),
    db.select({ n: count() }).from(addresses).where(and(eq(addresses.userId, c.userId), isNull(addresses.deletedAt))),
    db.select({ n: count() }).from(wishlistItems).innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId)).where(eq(wishlists.userId, c.userId)),
    db.select({ n: count() }).from(customerDesigns).where(and(eq(customerDesigns.customerId, c.userId), isNull(customerDesigns.deletedAt))),
  ]);
  return { profile, counts: { addresses: addr?.n ?? 0, wishlist: wish?.n ?? 0, designs: des?.n ?? 0 } };
}
