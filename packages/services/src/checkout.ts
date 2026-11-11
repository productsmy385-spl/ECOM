/**
 * Checkout and payments.
 *
 * placeOrder runs ONE transaction that re-prices the cart from the catalogue,
 * reserves stock with a guarded UPDATE (plus the inventory CHECK constraint,
 * so overselling is impossible), redeems the coupon, snapshots items and the
 * address onto the order, records history and the payment row, and clears the
 * cart. Repeated submissions with the same idempotency key return the same order.
 *
 * Razorpay orders are paid via Checkout.js. An order is marked paid only after
 * a server-side signature check AND a re-fetch of the payment from Razorpay,
 * or via a signature-verified webhook. Both paths are idempotent.
 * Unpaid Razorpay orders release their stock after the payment hold expires.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  addresses,
  couponRedemptions,
  coupons,
  type DbOrTx,
  db,
  inventory,
  inventoryMovements,
  orderItems,
  orders,
  orderStatusHistory,
  paymentEvents,
  payments,
  users,
} from "@ecom/db";
import { AuthenticationError } from "@ecom/rbac";
import { checkoutSchema, priceOrder, razorpayVerifySchema, type ShippingAddress } from "@ecom/validation";
import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { clearCartLines, _findCartForCheckout as findCart, loadCartLines, loadUsableCoupon, type Shopper, type UsableCoupon } from "./cart";
import { ConflictError, NotFoundError, uniqueViolation, ValidationError } from "./errors";
import { type PaymentGateway, razorpayGateway, verifyRazorpayWebhook } from "./razorpay";
import { getCheckoutSettings } from "./settings";

type OrderStatus = (typeof orders.$inferSelect)["status"];

/** How a caller proves it may see an order: the signed-in customer, or the secret token from a guest's order link. */
export type OrderAccess = { customerId: string } | { orderToken: string };

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

function accessWhere(access: OrderAccess) {
  return "customerId" in access
    ? eq(orders.customerId, access.customerId)
    : and(isNull(orders.customerId), eq(orders.guestAccessHash, hashToken(access.orderToken)))!;
}

export interface PaymentStart {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: "INR";
  orderNumber: string;
  prefill: { name: string; email: string; contact: string };
}

export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "razorpay" | "cod";
  total: number;
  /** Guests only, returned once: the secret for their order link. */
  orderToken?: string;
  /** Razorpay only: what Checkout.js needs. Null if Razorpay could not be reached (retry from the order page). */
  payment?: PaymentStart | null;
  paymentError?: string;
}

/** Checkout options the storefront needs to render (no secrets). */
export async function getCheckoutOptions(gateway: PaymentGateway | null = razorpayGateway()) {
  const s = await getCheckoutSettings();
  return {
    guestCheckoutEnabled: s.guestCheckoutEnabled,
    razorpayEnabled: !!gateway,
    codEnabled: s.codEnabled,
    codMaxAmount: s.codMaxAmount,
    standardDays: s.standardDays,
    expressDays: s.expressDays,
    standardFee: s.standardFee,
    expressFee: s.expressFee,
    freeShippingThreshold: s.freeShippingThreshold,
    paymentHoldMinutes: s.paymentHoldMinutes,
  };
}

// =================================================================== place

export async function placeOrder(
  shopper: Shopper,
  raw: unknown,
  opts: { customer?: { userId: string; email: string; name: string } | null; gateway?: PaymentGateway | null } = {},
): Promise<PlacedOrder> {
  const input = checkoutSchema.parse(raw);
  const gateway = opts.gateway === undefined ? razorpayGateway() : opts.gateway;
  const customer = opts.customer ?? null;
  if ("customerId" in shopper && shopper.customerId !== customer?.userId) throw new AuthenticationError();
  const settings = await getCheckoutSettings();

  if (!customer) {
    if (!settings.guestCheckoutEnabled) throw new AuthenticationError("Please sign in to check out.");
    if (!input.email) throw new ValidationError("Enter your email for order updates.", { email: ["Email is required"] });
    if (input.savedAddressId) throw new ValidationError("Enter a delivery address.", { address: ["Enter a delivery address"] });
  }
  if (input.paymentMethod === "razorpay" && !gateway) throw new ConflictError("Online payment isn't available yet. Choose another payment method.");
  if (input.paymentMethod === "cod" && !settings.codEnabled) throw new ConflictError("Cash on delivery isn't available.");

  // Idempotency: the same key from the same shopper returns the existing order.
  const prior = await db.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey)).limit(1);
  if (prior[0]) return resumePlaced(prior[0], customer, gateway, shopper);

  const placed = await db.transaction(async (tx) => {
    const cart = await findCart(tx, shopper, { lock: true });
    if (!cart) throw new ConflictError("Your cart is empty.");
    const lines = await loadCartLines(tx, shopper, cart.id);
    if (lines.length === 0) throw new ConflictError("Your cart is empty.");
    const blocked = lines.filter((l) => l.issue);
    if (blocked.length) throw new ConflictError(`Please review your cart: ${blocked.map((l) => `${l.productName}: ${l.issue}`).join(" ")}`);

    // Address: a saved one (must be the customer's own) or the one entered.
    let address: ShippingAddress;
    if (input.savedAddressId) {
      const [a] = await tx
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, input.savedAddressId), eq(addresses.userId, customer!.userId), isNull(addresses.deletedAt)));
      if (!a) throw new ValidationError("Choose a delivery address.", { savedAddressId: ["Address not found"] });
      address = { fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2, landmark: a.landmark, city: a.city, state: a.state as ShippingAddress["state"], postalCode: a.postalCode };
    } else {
      address = input.address as ShippingAddress;
      if (customer && input.saveAddress) {
        const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(addresses).where(and(eq(addresses.userId, customer.userId), isNull(addresses.deletedAt)))) as [{ n: number }];
        if (n < 20) await tx.insert(addresses).values({ userId: customer.userId, ...address, isDefault: n === 0 });
      }
    }

    // Coupon: re-checked under a row lock so usage limits hold under concurrency.
    let coupon: UsableCoupon | null = null;
    if (cart.couponCode) {
      coupon = await loadUsableCoupon(tx, cart.couponCode, customer ? { customerId: customer.userId } : { email: input.email }, { lock: true });
    }
    const priced = priceOrder({
      lines: lines.map((l) => ({ key: l.id, unitPrice: l.unitPrice, quantity: l.quantity, taxRateBps: l.taxRateBps })),
      coupon,
      shipping: { freeThreshold: settings.freeShippingThreshold, standardFee: settings.standardFee, expressFee: settings.expressFee },
      method: input.shippingMethod,
    });
    const couponApplied = !!(coupon && priced.coupon?.applied);
    if (input.paymentMethod === "cod" && priced.total > settings.codMaxAmount) {
      throw new ConflictError("This order is above the cash-on-delivery limit. Please pay online.");
    }

    // Reserve stock, per variant in a fixed order (no deadlocks between concurrent checkouts).
    const perVariant = new Map<string, number>();
    for (const l of lines) perVariant.set(l.variantId, (perVariant.get(l.variantId) ?? 0) + l.quantity);
    const soldOut: string[] = [];
    for (const variantId of [...perVariant.keys()].sort()) {
      const qty = perVariant.get(variantId)!;
      const ok = await tx
        .update(inventory)
        .set({ reserved: sql`${inventory.reserved} + ${qty}`, updatedAt: new Date() })
        .where(and(eq(inventory.variantId, variantId), sql`${inventory.onHand} - ${inventory.reserved} >= ${qty}`))
        .returning({ variantId: inventory.variantId });
      if (ok.length === 0) soldOut.push(lines.find((l) => l.variantId === variantId)!.productName);
    }
    if (soldOut.length) throw new ConflictError(`Sorry, these just sold out or have fewer left: ${soldOut.join(", ")}. Update your cart and try again.`);

    const [{ seq }] = (await tx.execute(sql`select nextval('order_number_seq')::text as seq`)).rows as [{ seq: string }];
    const orderNumber = `ORD-${new Date().getFullYear()}-${seq.padStart(6, "0")}`;
    const requiresDesignReview = lines.some((l) => l.design && !l.design.approved);
    const status: OrderStatus = input.paymentMethod === "razorpay" ? "payment_pending" : requiresDesignReview ? "design_review" : "confirmed";
    const orderToken = customer ? undefined : randomBytes(24).toString("base64url");
    const now = new Date();

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        customerId: customer?.userId ?? null,
        guestEmail: customer ? null : input.email!,
        guestPhone: customer ? null : address.phone,
        guestAccessHash: orderToken ? hashToken(orderToken) : null,
        status,
        paymentStatus: "created",
        paymentProvider: input.paymentMethod,
        shippingAddress: address,
        shippingMethod: input.shippingMethod,
        subtotal: priced.subtotal,
        discountAmount: priced.discount,
        taxAmount: priced.taxAmount,
        shippingAmount: priced.shipping,
        totalAmount: priced.total,
        couponCode: couponApplied ? coupon!.code : null,
        requiresDesignReview,
        customerNote: input.note ?? null,
        idempotencyKey: input.idempotencyKey,
        confirmedAt: status === "payment_pending" ? null : now,
      })
      .returning();

    const pricedByKey = new Map(priced.lines.map((p) => [p.key, p]));
    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order!.id,
        productId: l.productId,
        variantId: l.variantId,
        productName: l.productName,
        variantName: l.variantName,
        sku: l.sku,
        imageUrl: l.imageUrl,
        unitPrice: l.basePrice,
        customizationPrice: l.customizationPrice,
        quantity: l.quantity,
        taxRateBps: l.taxRateBps,
        taxAmount: pricedByKey.get(l.id)!.taxAmount,
        lineTotal: l.lineTotal,
        customization: l.design ? { options: l.design.full.values, summary: l.design.full.summary, config: l.design.full.config } : null,
        designId: l.design?.id ?? null,
        designVersionId: l.design?.versionId ?? null,
        requiresDesignReview: !!(l.design && !l.design.approved),
      })),
    );

    await tx.insert(inventoryMovements).values(
      [...perVariant].map(([variantId, qty]) => ({
        variantId,
        type: "reservation" as const,
        reservedDelta: qty,
        referenceType: "order",
        referenceId: order!.id,
        note: orderNumber,
        actorId: customer?.userId ?? null,
      })),
    );
    await tx.insert(orderStatusHistory).values({ orderId: order!.id, fromStatus: null, toStatus: status, actorId: customer?.userId ?? null, note: "Order placed" });
    await tx.insert(payments).values({ orderId: order!.id, provider: input.paymentMethod, status: "created", amount: priced.total });

    if (couponApplied) {
      await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, coupon!.id));
      await tx.insert(couponRedemptions).values({ couponId: coupon!.id, orderId: order!.id, userId: customer?.userId ?? null, discountAmount: priced.discount });
    }

    await clearCartLines(tx, cart.id, lines.map((l) => l.id));
    return { order: order!, orderToken };
  }).catch((err) => {
    // Two submissions with the same key raced: return the winner.
    if (uniqueViolation(err)?.constraint?.includes("idempotency")) return null;
    throw err;
  });

  if (!placed) {
    const [o] = await db.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey));
    return resumePlaced(o!, customer, gateway, shopper);
  }

  const result: PlacedOrder = {
    orderId: placed.order.id,
    orderNumber: placed.order.orderNumber,
    status: placed.order.status,
    paymentMethod: placed.order.paymentProvider,
    total: placed.order.totalAmount,
    orderToken: placed.orderToken,
  };
  if (placed.order.paymentProvider === "razorpay") {
    try {
      result.payment = await startPayment(placed.order.id, gateway!, contactFor(placed.order, customer));
    } catch (err) {
      result.payment = null;
      result.paymentError = (err as Error).message;
    }
  }
  return result;
}

function contactFor(o: typeof orders.$inferSelect, customer: { email: string; name: string } | null) {
  const a = o.shippingAddress as ShippingAddress;
  return { name: a.fullName ?? customer?.name ?? "", email: customer?.email ?? o.guestEmail ?? "", contact: a.phone ?? "" };
}

async function resumePlaced(
  o: typeof orders.$inferSelect,
  customer: { userId: string; email: string; name: string } | null,
  gateway: PaymentGateway | null,
  shopper: Shopper,
): Promise<PlacedOrder> {
  // A key belongs to whoever placed it. A guest retry can't recover the link token, so it gets a conflict.
  const mine = customer ? o.customerId === customer.userId : false;
  if (!mine) throw new ConflictError("This checkout was already submitted. Check your email or order history.");
  void shopper;
  const r: PlacedOrder = { orderId: o.id, orderNumber: o.orderNumber, status: o.status, paymentMethod: o.paymentProvider, total: o.totalAmount };
  if (o.paymentProvider === "razorpay" && o.status === "payment_pending" && gateway) {
    try {
      r.payment = await startPayment(o.id, gateway, contactFor(o, customer));
    } catch (err) {
      r.payment = null;
      r.paymentError = (err as Error).message;
    }
  }
  return r;
}

/** Creates (or reuses) the Razorpay order for an unpaid order. */
async function startPayment(orderId: string, gateway: PaymentGateway, prefill: PaymentStart["prefill"]): Promise<PaymentStart> {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw new NotFoundError("Order not found.");
  if (o.status !== "payment_pending") throw new ConflictError("This order doesn't need payment.");
  const [p] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.provider, "razorpay")))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  let rzpOrderId = p?.razorpayOrderId ?? null;
  if (!rzpOrderId) {
    const created = await gateway.createOrder({ amount: o.totalAmount, receipt: o.orderNumber, notes: { orderId: o.id, orderNumber: o.orderNumber } });
    if (created.amount !== o.totalAmount) throw new ConflictError("Payment amount mismatch.");
    rzpOrderId = created.id;
    await db.update(payments).set({ razorpayOrderId: rzpOrderId, updatedAt: new Date() }).where(eq(payments.id, p!.id));
  }
  return { keyId: gateway.keyId, razorpayOrderId: rzpOrderId, amount: o.totalAmount, currency: "INR", orderNumber: o.orderNumber, prefill };
}

/** "Pay now" on the order page (retry after a closed or failed payment). */
export async function retryPayment(access: OrderAccess, orderId: string, gateway: PaymentGateway | null = razorpayGateway()): Promise<PaymentStart> {
  if (!gateway) throw new ConflictError("Online payment isn't available yet.");
  const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), accessWhere(access)));
  if (!o) throw new NotFoundError("Order not found.");
  const [u] = o.customerId ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, o.customerId)) : [];
  return startPayment(o.id, gateway, contactFor(o, u ?? null));
}

// ============================================================ mark as paid

/**
 * Marks an order paid after a verified capture. Idempotent: safe to call from
 * both the browser callback and the webhook, in any order, any number of times.
 */
async function markPaid(tx: DbOrTx, rzpOrderId: string, pay: { id: string; amount: number; method: string | null }) {
  const [p] = await tx.select().from(payments).where(eq(payments.razorpayOrderId, rzpOrderId)).for("update");
  if (!p) throw new NotFoundError("Payment not found.");
  if (p.status === "captured") return { orderId: p.orderId, already: true };
  if (pay.amount !== p.amount) throw new ConflictError("Payment amount doesn't match the order.");
  const now = new Date();
  await tx
    .update(payments)
    .set({ status: "captured", razorpayPaymentId: pay.id, method: pay.method, verifiedAt: now, capturedAt: now, failureReason: null, updatedAt: now })
    .where(eq(payments.id, p.id));
  const [o] = await tx.select().from(orders).where(eq(orders.id, p.orderId)).for("update");
  if (o!.status === "payment_pending") {
    const next: OrderStatus = o!.requiresDesignReview ? "design_review" : "confirmed";
    await tx.update(orders).set({ status: next, paymentStatus: "captured", confirmedAt: now, updatedAt: now }).where(eq(orders.id, o!.id));
    await tx.insert(orderStatusHistory).values({ orderId: o!.id, fromStatus: "payment_pending", toStatus: next, note: "Payment received" });
  } else {
    // Paid after the hold expired and the order was cancelled: keep the money on record for a refund.
    await tx.update(orders).set({ paymentStatus: "captured", updatedAt: now }).where(eq(orders.id, o!.id));
    await tx.insert(orderStatusHistory).values({
      orderId: o!.id,
      fromStatus: o!.status,
      toStatus: o!.status,
      note: "Payment received after the order was cancelled. A refund is needed.",
      isCustomerVisible: false,
    });
  }
  return { orderId: o!.id, already: false };
}

/** Browser callback from Checkout.js: verify signature, re-fetch the payment, capture if needed, mark paid. */
export async function verifyRazorpayPayment(access: OrderAccess, orderId: string, raw: unknown, gateway: PaymentGateway | null = razorpayGateway()) {
  if (!gateway) throw new ConflictError("Online payment isn't available.");
  const input = razorpayVerifySchema.parse(raw);
  const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), accessWhere(access)));
  if (!o) throw new NotFoundError("Order not found.");
  const [p] = await db.select().from(payments).where(and(eq(payments.orderId, o.id), eq(payments.razorpayOrderId, input.razorpayOrderId)));
  if (!p) throw new ValidationError("This payment doesn't belong to this order.");
  if (!gateway.verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
    throw new ValidationError("We couldn't verify this payment. If money was taken, it will be confirmed automatically or refunded.");
  }
  let pay = await gateway.fetchPayment(input.razorpayPaymentId);
  if (pay.orderId !== input.razorpayOrderId) throw new ValidationError("This payment doesn't belong to this order.");
  if (pay.status === "authorized") pay = await gateway.capturePayment(pay.id, p.amount);
  if (pay.status !== "captured") throw new ConflictError("The payment hasn't completed. Please try again.");
  await db.transaction((tx) => markPaid(tx, input.razorpayOrderId, pay));
  return getOrder(access, o.id);
}

/**
 * Razorpay webhook. Verifies the HMAC of the raw body, stores each event once
 * (unique provider + event id), and processes it idempotently. Throws on
 * processing errors so Razorpay retries.
 */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null, eventId: string | null, secret: string | undefined = process.env.RAZORPAY_WEBHOOK_SECRET) {
  if (!secret) return { status: 503 as const, body: "Webhook not configured" };
  if (!verifyRazorpayWebhook(rawBody, signature, secret)) return { status: 400 as const, body: "Invalid signature" };
  const evt = JSON.parse(rawBody) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; status: string; method?: string; error_description?: string } } };
  };
  const id = eventId ?? createHash("sha256").update(rawBody).digest("hex");
  const inserted = await db
    .insert(paymentEvents)
    .values({ provider: "razorpay", eventId: id, eventType: evt.event.slice(0, 64), payload: evt })
    .onConflictDoNothing()
    .returning({ id: paymentEvents.id });
  let rowId = inserted[0]?.id;
  if (!rowId) {
    const [existing] = await db.select().from(paymentEvents).where(and(eq(paymentEvents.provider, "razorpay"), eq(paymentEvents.eventId, id)));
    if (existing?.processedAt) return { status: 200 as const, body: "duplicate" };
    rowId = existing!.id;
  }
  try {
    const pay = evt.payload?.payment?.entity;
    if (pay?.order_id && (evt.event === "payment.captured" || evt.event === "order.paid")) {
      const [known] = await db.select({ id: payments.id }).from(payments).where(eq(payments.razorpayOrderId, pay.order_id));
      if (known) await db.transaction((tx) => markPaid(tx, pay.order_id, { id: pay.id, amount: pay.amount, method: pay.method ?? null }));
    } else if (pay?.order_id && evt.event === "payment.failed") {
      await db
        .update(payments)
        .set({ failureReason: (pay.error_description ?? "Payment failed").slice(0, 500), updatedAt: new Date() })
        .where(and(eq(payments.razorpayOrderId, pay.order_id), sql`${payments.status} <> 'captured'`));
    }
    await db.update(paymentEvents).set({ processedAt: new Date(), error: null }).where(eq(paymentEvents.id, rowId));
    return { status: 200 as const, body: "ok" };
  } catch (err) {
    await db.update(paymentEvents).set({ error: String((err as Error).message).slice(0, 1000) }).where(eq(paymentEvents.id, rowId));
    throw err;
  }
}

// ============================================================ hold expiry

/**
 * Cancels Razorpay orders left unpaid past the hold and releases their stock
 * and coupon use. Before cancelling, Razorpay is asked whether a payment
 * actually went through (in case the webhook was missed).
 */
export async function releaseExpiredHolds(gateway: PaymentGateway | null = razorpayGateway(), now = new Date()): Promise<number> {
  const { paymentHoldMinutes } = await getCheckoutSettings();
  const cutoff = new Date(now.getTime() - paymentHoldMinutes * 60_000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "payment_pending"), lt(orders.placedAt, cutoff)))
    .orderBy(asc(orders.placedAt))
    .limit(100);
  let released = 0;
  for (const { id } of stale) {
    const [p] = await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.createdAt)).limit(1);
    if (gateway && p?.razorpayOrderId) {
      try {
        const paid = (await gateway.listOrderPayments(p.razorpayOrderId)).find((x) => x.status === "captured");
        if (paid) {
          await db.transaction((tx) => markPaid(tx, p.razorpayOrderId!, paid));
          continue;
        }
      } catch (err) {
        console.error("[checkout] could not check Razorpay before releasing", id, (err as Error).message);
        continue; // try again on the next sweep rather than cancel blindly
      }
    }
    const done = await db.transaction(async (tx) => {
      const [o] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.status, "payment_pending"))).for("update", { skipLocked: true });
      if (!o) return false;
      await releaseReservations(tx, o.id, o.orderNumber);
      const [red] = await tx.delete(couponRedemptions).where(eq(couponRedemptions.orderId, o.id)).returning();
      if (red) await tx.update(coupons).set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.id, red.couponId));
      await tx.update(orders).set({ status: "cancelled", cancelledAt: now, cancelReason: "Payment not completed in time", updatedAt: now }).where(eq(orders.id, o.id));
      await tx.update(payments).set({ status: "failed", failureReason: "Payment window expired", updatedAt: now }).where(and(eq(payments.orderId, o.id), sql`${payments.status} <> 'captured'`));
      await tx.insert(orderStatusHistory).values({ orderId: o.id, fromStatus: "payment_pending", toStatus: "cancelled", note: "Payment wasn't completed in time, so the order was cancelled and the items released." });
      return true;
    });
    if (done) released++;
  }
  return released;
}

async function releaseReservations(tx: DbOrTx, orderId: string, orderNumber: string) {
  const items = await tx.select({ variantId: orderItems.variantId, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const perVariant = new Map<string, number>();
  for (const i of items) perVariant.set(i.variantId, (perVariant.get(i.variantId) ?? 0) + i.quantity);
  for (const variantId of [...perVariant.keys()].sort()) {
    const qty = perVariant.get(variantId)!;
    await tx
      .update(inventory)
      .set({ reserved: sql`greatest(${inventory.reserved} - ${qty}, 0)`, updatedAt: new Date() })
      .where(eq(inventory.variantId, variantId));
    await tx.insert(inventoryMovements).values({ variantId, type: "release", reservedDelta: -qty, referenceType: "order", referenceId: orderId, note: `${orderNumber} payment expired` });
  }
}

// ================================================================ reading

export interface CustomerOrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: (typeof orders.$inferSelect)["paymentStatus"];
  paymentMethod: "razorpay" | "cod";
  placedAt: Date;
  shippingMethod: string;
  shippingAddress: ShippingAddress;
  email: string | null;
  amounts: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  couponCode: string | null;
  requiresDesignReview: boolean;
  items: { id: string; productName: string; variantName: string; imageUrl: string | null; quantity: number; unitPrice: number; customizationPrice: number; lineTotal: number; summary: { label: string; value: string }[] }[];
  history: { status: OrderStatus; note: string | null; at: Date }[];
  /** Razorpay orders still awaiting payment, until this time. */
  payBy: Date | null;
}

export async function getOrder(access: OrderAccess, orderIdOrNumber: string): Promise<CustomerOrderView> {
  const isNumber = /^ORD-/i.test(orderIdOrNumber);
  const isUuid = /^[0-9a-f-]{36}$/i.test(orderIdOrNumber);
  if (!isNumber && !isUuid) throw new NotFoundError("Order not found.");
  const [o] = await db
    .select()
    .from(orders)
    .where(and(isNumber ? eq(orders.orderNumber, orderIdOrNumber.toUpperCase()) : eq(orders.id, orderIdOrNumber), accessWhere(access)));
  if (!o) throw new NotFoundError("Order not found.");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id)).orderBy(asc(orderItems.createdAt));
  const history = await db
    .select({ status: orderStatusHistory.toStatus, note: orderStatusHistory.note, at: orderStatusHistory.createdAt })
    .from(orderStatusHistory)
    .where(and(eq(orderStatusHistory.orderId, o.id), eq(orderStatusHistory.isCustomerVisible, true)))
    .orderBy(asc(orderStatusHistory.createdAt));
  const { paymentHoldMinutes } = await getCheckoutSettings();
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentProvider,
    placedAt: o.placedAt,
    shippingMethod: o.shippingMethod,
    shippingAddress: o.shippingAddress as ShippingAddress,
    email: o.guestEmail,
    amounts: { subtotal: o.subtotal, discount: o.discountAmount, shipping: o.shippingAmount, tax: o.taxAmount, total: o.totalAmount },
    couponCode: o.couponCode,
    requiresDesignReview: o.requiresDesignReview,
    items: items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      customizationPrice: i.customizationPrice,
      lineTotal: i.lineTotal,
      summary: ((i.customization as { summary?: { label: string; value: string }[] } | null)?.summary ?? []).map(({ label, value }) => ({ label, value })),
    })),
    history,
    payBy: o.status === "payment_pending" ? new Date(o.placedAt.getTime() + paymentHoldMinutes * 60_000) : null,
  };
}

export async function listCustomerOrders(customerId: string) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      total: orders.totalAmount,
      placedAt: orders.placedAt,
      itemCount: sql<number>`(select coalesce(sum(quantity), 0)::int from ${orderItems} oi where oi.order_id = "orders"."id")`,
    })
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.placedAt))
    .limit(100);
}

