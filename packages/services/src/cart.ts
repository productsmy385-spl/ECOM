/**
 * Shopping cart. A cart belongs to a signed-in customer or to the anonymous
 * guest token (the same httpOnly cookie that owns guest designs). Ownership is
 * always supplied by the caller from the verified session or cookie, never
 * from request input; other shoppers' cart lines read as missing (404).
 *
 * Prices are never stored on cart lines: every read re-prices from the
 * catalogue, so the cart always shows what checkout will charge.
 */
import {
  cartItems,
  carts,
  categories,
  couponRedemptions,
  coupons,
  type DbOrTx,
  db,
  inventory,
  orders,
  productImages,
  products,
  productVariants,
} from "@ecom/db";
import {
  cartAddSchema,
  cartUpdateSchema,
  type CouponRule,
  couponCodeSchema,
  MAX_LINE_QTY,
  type PriceResult,
  priceOrder,
  type ShippingMethod,
} from "@ecom/validation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { type DesignOwner, loadOrderableDesign, type OrderableDesign, productRequiresDesign } from "./customization";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { getCheckoutSettings } from "./settings";

export type Shopper = DesignOwner;
const MAX_LINES = 30;

function ownerWhere(owner: Shopper) {
  return "customerId" in owner ? eq(carts.userId, owner.customerId) : and(eq(carts.guestToken, owner.guestToken), isNull(carts.userId))!;
}

async function findCart(conn: DbOrTx, owner: Shopper, { create = false, lock = false } = {}) {
  const q = conn.select().from(carts).where(ownerWhere(owner)).limit(1);
  const [existing] = lock ? await q.for("update") : await q;
  if (existing || !create) return existing ?? null;
  const [created] = await conn
    .insert(carts)
    .values("customerId" in owner ? { userId: owner.customerId } : { guestToken: owner.guestToken })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Lost a race with a concurrent request creating the same cart.
  const [again] = await conn.select().from(carts).where(ownerWhere(owner)).limit(1);
  return again!;
}

// ------------------------------------------------------------------ coupons

export interface UsableCoupon extends CouponRule {
  id: string;
}

/**
 * Loads a coupon and checks everything except the minimum order (which
 * pricing reports with a friendly "add ₹X more" message). Throws a
 * ConflictError with a customer-facing reason when it can't be used.
 */
export async function loadUsableCoupon(
  conn: DbOrTx,
  rawCode: string,
  who: { customerId?: string; email?: string },
  { lock = false } = {},
): Promise<UsableCoupon> {
  const code = rawCode.trim().toUpperCase();
  const q = conn.select().from(coupons).where(sql`upper(${coupons.code}) = ${code}`).limit(1);
  const [c] = lock ? await q.for("update") : await q;
  const now = new Date();
  if (!c || !c.isActive) throw new ConflictError("This code isn't valid.");
  if (c.startsAt && c.startsAt > now) throw new ConflictError("This code isn't active yet.");
  if (c.endsAt && c.endsAt <= now) throw new ConflictError("This code has expired.");
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) throw new ConflictError("This code has been fully used.");
  if (who.customerId || who.email) {
    const [{ n }] = (await conn
      .select({ n: sql<number>`count(*)::int` })
      .from(couponRedemptions)
      .innerJoin(orders, eq(orders.id, couponRedemptions.orderId))
      .where(
        and(
          eq(couponRedemptions.couponId, c.id),
          who.customerId ? eq(couponRedemptions.userId, who.customerId) : sql`lower(${orders.guestEmail}) = ${who.email!.toLowerCase()}`,
        ),
      )) as [{ n: number }];
    if (n >= c.perCustomerLimit) throw new ConflictError("You've already used this code.");
  }
  return {
    id: c.id,
    code: c.code.toUpperCase(),
    type: c.type,
    value: c.value,
    minOrderAmount: c.minOrderAmount,
    maxDiscountAmount: c.maxDiscountAmount,
  };
}

// ---------------------------------------------------------------- lines

export interface CartLineView {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  basePrice: number;
  customizationPrice: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  taxRateBps: number;
  /** Units that can still be bought right now. */
  available: number;
  design: { id: string; name: string; versionId: string; approved: boolean; summary: OrderableDesign["summary"] } | null;
  /** Customer-facing reason this line blocks checkout. */
  issue: string | null;
}

export interface CartView {
  id: string | null;
  lines: CartLineView[];
  count: number;
  couponCode: string | null;
  couponError: string | null;
  pricing: PriceResult;
  shippingMethod: ShippingMethod;
  /** False while any line has an issue (or the cart is empty). */
  canCheckout: boolean;
  requiresDesignReview: boolean;
}

/** Internal: lines with live prices, stock and design checks. Used by the cart view and by checkout. */
export async function loadCartLines(conn: DbOrTx, owner: Shopper, cartId: string): Promise<(CartLineView & { design: (CartLineView["design"] & { full: OrderableDesign }) | null })[]> {
  const rows = await conn
    .select({
      id: cartItems.id,
      quantity: cartItems.quantity,
      designId: cartItems.designId,
      variantId: productVariants.id,
      variantName: productVariants.name,
      sku: productVariants.sku,
      price: productVariants.price,
      variantActive: sql<boolean>`${productVariants.isActive} and ${productVariants.deletedAt} is null`,
      productId: products.id,
      productSlug: products.slug,
      productName: products.name,
      taxRateBps: products.taxRateBps,
      productLive: sql<boolean>`${products.status} = 'published' and ${products.deletedAt} is null and ${categories.isActive} and ${categories.deletedAt} is null`,
      available: sql<number>`greatest(coalesce(${inventory.onHand} - ${inventory.reserved}, 0), 0)::int`,
      imageUrl: sql<string | null>`(select url from ${productImages} i where i.product_id = ${products.id} order by i.sort_order limit 1)`,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.createdAt));

  const out = [];
  for (const r of rows) {
    let design: (CartLineView["design"] & { full: OrderableDesign }) | null = null;
    let issue: string | null = null;
    let customizationPrice = 0;
    if (!r.productLive || !r.variantActive) issue = "This item is no longer available.";
    if (r.designId) {
      const d = await loadOrderableDesign(conn, owner, r.designId);
      if (!d.ok) issue ??= d.reason;
      else {
        customizationPrice = d.design.priceDelta;
        design = { id: d.design.designId, name: d.design.name, versionId: d.design.versionId, approved: d.design.approved, summary: d.design.summary, full: d.design };
      }
    } else if (!issue && (await productRequiresDesign(conn, r.productId))) {
      issue = "This product needs your design. Customise it first.";
    }
    if (!issue && r.available < r.quantity) issue = r.available === 0 ? "Out of stock." : `Only ${r.available} left.`;
    const unitPrice = r.price + customizationPrice;
    out.push({
      id: r.id,
      productId: r.productId,
      productSlug: r.productSlug,
      productName: r.productName,
      variantId: r.variantId,
      variantName: r.variantName,
      sku: r.sku,
      imageUrl: r.imageUrl,
      basePrice: r.price,
      customizationPrice,
      unitPrice,
      quantity: r.quantity,
      lineTotal: unitPrice * r.quantity,
      taxRateBps: r.taxRateBps,
      available: r.available,
      design,
      issue,
    });
  }
  return out;
}

export async function getCart(owner: Shopper, method: ShippingMethod = "standard"): Promise<CartView> {
  const settings = await getCheckoutSettings();
  const cart = await findCart(db, owner);
  const lines = cart ? await loadCartLines(db, owner, cart.id) : [];
  const valid = lines.filter((l) => !l.issue);

  let coupon: UsableCoupon | null = null;
  let couponError: string | null = null;
  if (cart?.couponCode) {
    try {
      coupon = await loadUsableCoupon(db, cart.couponCode, "customerId" in owner ? { customerId: owner.customerId } : {});
    } catch (err) {
      couponError = (err as Error).message;
    }
  }
  const pricing = priceOrder({
    lines: valid.map((l) => ({ key: l.id, unitPrice: l.unitPrice, quantity: l.quantity, taxRateBps: l.taxRateBps })),
    coupon,
    shipping: { freeThreshold: settings.freeShippingThreshold, standardFee: settings.standardFee, expressFee: settings.expressFee },
    method,
  });
  if (pricing.coupon && !pricing.coupon.applied) couponError = pricing.coupon.reason ?? "This code can't be used on this cart.";

  return {
    id: cart?.id ?? null,
    lines: lines.map(({ design, ...l }) => ({ ...l, design: design ? { id: design.id, name: design.name, versionId: design.versionId, approved: design.approved, summary: design.summary } : null })),
    count: lines.reduce((a, l) => a + l.quantity, 0),
    couponCode: cart?.couponCode ?? null,
    couponError,
    pricing,
    shippingMethod: method,
    canCheckout: lines.length > 0 && lines.every((l) => !l.issue),
    requiresDesignReview: lines.some((l) => l.design && !l.design.approved),
  };
}

/** Item count for the header badge (cheap: no pricing). */
export async function cartCount(owner: Shopper): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .where(ownerWhere(owner));
  return r?.n ?? 0;
}

// ---------------------------------------------------------------- writes

export async function addToCart(owner: Shopper, raw: unknown): Promise<CartView> {
  const input = cartAddSchema.parse(raw);
  await db.transaction(async (tx) => {
    const [v] = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        available: sql<number>`greatest(coalesce(${inventory.onHand} - ${inventory.reserved}, 0), 0)::int`,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(
        and(
          eq(productVariants.id, input.variantId),
          eq(productVariants.isActive, true),
          isNull(productVariants.deletedAt),
          eq(products.status, "published"),
          isNull(products.deletedAt),
          eq(categories.isActive, true),
          isNull(categories.deletedAt),
        ),
      );
    if (!v) throw new NotFoundError("This item is no longer available.");

    let designVersionId: string | null = null;
    if (input.designId) {
      const d = await loadOrderableDesign(tx, owner, input.designId);
      if (!d.ok) throw new ConflictError(d.reason);
      if (d.design.productId !== v.productId || (d.design.variantId && d.design.variantId !== v.id)) {
        throw new ValidationError("This design belongs to a different product option.", { designId: ["Mismatched design"] });
      }
      designVersionId = d.design.versionId;
    } else if (await productRequiresDesign(tx, v.productId)) {
      throw new ConflictError("This product needs your design. Customise it first.");
    }

    const cart = (await findCart(tx, owner, { create: true, lock: false }))!;
    await tx.select({ id: carts.id }).from(carts).where(eq(carts.id, cart.id)).for("update");

    // Same variant + same design version → one line with a higher quantity.
    const [same] = await tx
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.variantId, v.id),
          designVersionId ? eq(cartItems.designVersionId, designVersionId) : isNull(cartItems.designVersionId),
        ),
      );
    const quantity = Math.min((same?.quantity ?? 0) + input.quantity, MAX_LINE_QTY);
    if (v.available < quantity) {
      throw new ConflictError(v.available === 0 ? "Sorry, this is out of stock." : `Only ${v.available} left in stock.`);
    }
    if (same) {
      await tx.update(cartItems).set({ quantity }).where(eq(cartItems.id, same.id));
    } else {
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(cartItems).where(eq(cartItems.cartId, cart.id))) as [{ n: number }];
      if (n >= MAX_LINES) throw new ConflictError(`Your cart can hold up to ${MAX_LINES} different items.`);
      await tx.insert(cartItems).values({ cartId: cart.id, variantId: v.id, quantity, designId: input.designId ?? null, designVersionId });
    }
    await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
  });
  return getCart(owner);
}

async function ownedItem(conn: DbOrTx, owner: Shopper, itemId: string) {
  const [row] = await conn
    .select({ id: cartItems.id, cartId: cartItems.cartId, variantId: cartItems.variantId })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .where(and(eq(cartItems.id, itemId), ownerWhere(owner)));
  if (!row) throw new NotFoundError("Item not found in your cart.");
  return row;
}

export async function updateCartItem(owner: Shopper, itemId: string, raw: unknown): Promise<CartView> {
  const { quantity } = cartUpdateSchema.parse(raw);
  await db.transaction(async (tx) => {
    const item = await ownedItem(tx, owner, itemId);
    const [inv] = await tx
      .select({ available: sql<number>`greatest(${inventory.onHand} - ${inventory.reserved}, 0)::int` })
      .from(inventory)
      .where(eq(inventory.variantId, item.variantId));
    const available = inv?.available ?? 0;
    if (available < quantity) throw new ConflictError(available === 0 ? "Sorry, this is out of stock." : `Only ${available} left in stock.`);
    await tx.update(cartItems).set({ quantity }).where(eq(cartItems.id, item.id));
  });
  return getCart(owner);
}

export async function removeCartItem(owner: Shopper, itemId: string): Promise<CartView> {
  const item = await ownedItem(db, owner, itemId);
  await db.delete(cartItems).where(eq(cartItems.id, item.id));
  return getCart(owner);
}

export async function applyCartCoupon(owner: Shopper, raw: unknown): Promise<CartView> {
  const { code } = couponCodeSchema.parse(raw);
  const cart = await findCart(db, owner);
  if (!cart) throw new ConflictError("Add something to your cart first.");
  try {
    await loadUsableCoupon(db, code, "customerId" in owner ? { customerId: owner.customerId } : {});
  } catch (err) {
    if (err instanceof ConflictError) throw new ValidationError(err.message, { code: [err.message] });
    throw err;
  }
  await db.update(carts).set({ couponCode: code }).where(eq(carts.id, cart.id));
  return getCart(owner);
}

export async function removeCartCoupon(owner: Shopper): Promise<CartView> {
  const cart = await findCart(db, owner);
  if (cart) await db.update(carts).set({ couponCode: null }).where(eq(carts.id, cart.id));
  return getCart(owner);
}

/**
 * On sign-in: moves the guest cart into the customer's cart. Matching lines
 * add up (capped per line); the customer's own coupon wins. Idempotent.
 */
export async function mergeGuestCart(customerId: string, guestToken: string): Promise<number> {
  return db.transaction(async (tx) => {
    const [guest] = await tx
      .select()
      .from(carts)
      .where(and(eq(carts.guestToken, guestToken), isNull(carts.userId)))
      .for("update");
    if (!guest) return 0;
    const items = await tx.select().from(cartItems).where(eq(cartItems.cartId, guest.id));
    const mine = (await findCart(tx, { customerId }, { create: true }))!;
    await tx.select({ id: carts.id }).from(carts).where(eq(carts.id, mine.id)).for("update");
    const existing = await tx.select().from(cartItems).where(eq(cartItems.cartId, mine.id));
    let moved = 0;
    for (const it of items) {
      const match = existing.find((e) => e.variantId === it.variantId && (e.designVersionId ?? null) === (it.designVersionId ?? null));
      if (match) {
        await tx.update(cartItems).set({ quantity: Math.min(match.quantity + it.quantity, MAX_LINE_QTY) }).where(eq(cartItems.id, match.id));
      } else if (existing.length + moved < MAX_LINES) {
        await tx.update(cartItems).set({ cartId: mine.id }).where(eq(cartItems.id, it.id));
        moved++;
      }
    }
    if (!mine.couponCode && guest.couponCode) await tx.update(carts).set({ couponCode: guest.couponCode }).where(eq(carts.id, mine.id));
    await tx.delete(carts).where(eq(carts.id, guest.id));
    return items.length;
  });
}

/** Removes the given cart lines (after an order is placed). */
export async function clearCartLines(conn: DbOrTx, cartId: string, itemIds: string[]) {
  if (itemIds.length) await conn.delete(cartItems).where(and(eq(cartItems.cartId, cartId), inArray(cartItems.id, itemIds)));
  await conn.update(carts).set({ couponCode: null, updatedAt: new Date() }).where(eq(carts.id, cartId));
}

export { findCart as _findCartForCheckout };
