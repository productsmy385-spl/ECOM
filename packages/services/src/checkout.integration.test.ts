/**
 * Cart and checkout against the real test DB: ownership isolation, design
 * rules, coupons, guest-cart merge, transactional order placement, stock
 * reservation without overselling (concurrent checkouts), idempotency,
 * Razorpay signature/webhook verification (fake gateway), hold expiry, and
 * order access for customers and guests.
 */
import { createHmac, randomUUID } from "node:crypto";
import { loadActor } from "@ecom/auth";
import {
  categories,
  couponRedemptions,
  coupons,
  customerDesigns,
  db,
  inventory,
  inventoryMovements,
  orders,
  paymentEvents,
  payments,
  products,
  productVariants,
  systemSettings,
  users,
} from "@ecom/db";
import type { Actor } from "@ecom/rbac";
import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addToCart,
  applyCartCoupon,
  ConflictError,
  createCoupon,
  createDesign,
  getCart,
  getOrder,
  handleRazorpayWebhook,
  mergeGuestCart,
  NotFoundError,
  type PaymentGateway,
  placeOrder,
  releaseExpiredHolds,
  removeCartItem,
  saveProductOptions,
  submitDesign,
  updateCartItem,
  updateCheckoutSettings,
  ValidationError,
  verifyRazorpayPayment,
} from "./index";
import { getCheckoutSettings } from "./settings";

const run = `k${Date.now().toString(36)}`;
const ctxOf = async (id: string) => ({ actor: (await loadActor(id)) as Actor });
const guest = (n: string) => ({ guestToken: `${run}-${n}`.padEnd(43, "x") });
const SECRET = "rzp_test_secret";
const address = { fullName: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" };

let root: string;
let customer: { userId: string; email: string; name: string };
let plain: { productId: string; variantId: string };
let scarce: { productId: string; variantId: string };
let custom: { productId: string; variantId: string };
let settingsBefore: Awaited<ReturnType<typeof getCheckoutSettings>>;

/** In-memory Razorpay: real HMAC signatures, payments "captured" on demand. */
function fakeGateway() {
  const paid = new Map<string, { id: string; orderId: string; amount: number; status: "captured" | "authorized" }>();
  let n = 0;
  const gw: PaymentGateway & { pay: (rzpOrderId: string, amount: number) => { paymentId: string; signature: string } } = {
    keyId: "rzp_test_key",
    async createOrder({ amount }) {
      return { id: `order_${randomUUID().replace(/-/g, "").slice(0, 20)}${++n}`, amount };
    },
    async fetchPayment(id) {
      const p = [...paid.values()].find((x) => x.id === id)!;
      return { id: p.id, orderId: p.orderId, amount: p.amount, currency: "INR", status: p.status, method: "upi", errorDescription: null };
    },
    async capturePayment(id) {
      const p = [...paid.values()].find((x) => x.id === id)!;
      p.status = "captured";
      return this.fetchPayment(id);
    },
    async listOrderPayments(orderId) {
      const p = paid.get(orderId);
      return p ? [await this.fetchPayment(p.id)] : [];
    },
    async refundPayment(_id, _amount) {
      return { id: `rfnd_${randomUUID().replace(/-/g, "").slice(0, 14)}`, status: "processed" };
    },
    verifyPaymentSignature(orderId, paymentId, signature) {
      return createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex") === signature;
    },
    pay(rzpOrderId, amount) {
      const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 20)}${++n}`;
      paid.set(rzpOrderId, { id: paymentId, orderId: rzpOrderId, amount, status: "authorized" });
      return { paymentId, signature: createHmac("sha256", SECRET).update(`${rzpOrderId}|${paymentId}`).digest("hex") };
    },
  };
  return gw;
}

async function makeProduct(name: string, { stock = 10, price = 50_000, review = false } = {}) {
  const [cat] = await db.insert(categories).values({ name: `Cat ${name} ${run}`, slug: `cat-${name}-${run}`.toLowerCase(), isCustomizable: true }).returning();
  const [p] = await db
    .insert(products)
    .values({ name: `${name} ${run}`, slug: `${name}-${run}`.toLowerCase(), categoryId: cat!.id, status: "published", publishedAt: new Date(), taxRateBps: 1800, requiresDesignReview: review, isCustomizable: review })
    .returning();
  const [v] = await db.insert(productVariants).values({ productId: p!.id, sku: `${run}-${name}`.toUpperCase(), name: "Std", price, isDefault: true }).returning();
  await db.insert(inventory).values({ variantId: v!.id, onHand: stock });
  return { productId: p!.id, variantId: v!.id };
}

const stockOf = async (variantId: string) => (await db.select().from(inventory).where(eq(inventory.variantId, variantId)))[0]!;

beforeAll(async () => {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  root = r!.id;
  const [u] = await db.insert(users).values({ name: "Shopper Test", email: `shopper.${run}@example.test` }).returning();
  customer = { userId: u!.id, email: u!.email, name: u!.name };
  plain = await makeProduct("Gloss", { price: 59_000 });
  scarce = await makeProduct("Rare", { stock: 1, price: 120_000 });
  custom = await makeProduct("Case", { review: true, price: 80_000 });
  await saveProductOptions(await ctxOf(root), custom.productId, {
    options: [{ key: "shade", label: "Shade", type: "color", isRequired: true, config: { choices: [{ value: "red", label: "Red", hex: "#CF0F47", priceDelta: 5_000 }] } }],
  });
  settingsBefore = await getCheckoutSettings();
  await updateCheckoutSettings(await ctxOf(root), { ...settingsBefore, codEnabled: true, guestCheckoutEnabled: true, codMaxAmount: 10_000_000 });
  await createCoupon(await ctxOf(root), { code: `TEN${run}`.toUpperCase().slice(0, 40), type: "percent", value: 1000, usageLimit: 5, perCustomerLimit: 5 });
  await createCoupon(await ctxOf(root), { code: `BIG${run}`.toUpperCase().slice(0, 40), type: "fixed", value: 10_000, minOrderAmount: 10_000_000 });
});

afterAll(async () => {
  await updateCheckoutSettings(await ctxOf(root), settingsBefore);
  const prods = await db.select({ id: products.id }).from(products).where(like(products.name, `% ${run}`));
  const ids = prods.map((p) => p.id);
  const variants = ids.length ? await db.select({ id: productVariants.id }).from(productVariants).where(inArray(productVariants.productId, ids)) : [];
  const ords = await db.select({ id: orders.id }).from(orders).where(sql`exists (select 1 from order_items i where i.order_id = ${orders.id} and i.product_id in (${sql.join(ids.length ? ids.map((i) => sql`${i}`) : [sql`null`], sql`, `)}))`);
  if (ords.length) {
    await db.delete(couponRedemptions).where(inArray(couponRedemptions.orderId, ords.map((o) => o.id)));
    await db.delete(payments).where(inArray(payments.orderId, ords.map((o) => o.id)));
    await db.delete(orders).where(inArray(orders.id, ords.map((o) => o.id)));
  }
  if (variants.length) await db.delete(inventoryMovements).where(inArray(inventoryMovements.variantId, variants.map((v) => v.id)));
  if (ids.length) {
    await db.delete(customerDesigns).where(inArray(customerDesigns.productId, ids));
    await db.delete(products).where(inArray(products.id, ids));
  }
  await db.delete(categories).where(like(categories.name, `% ${run}`));
  await db.delete(coupons).where(like(coupons.code, `%${run.toUpperCase()}`));
  await db.delete(paymentEvents).where(like(paymentEvents.eventId, `evt_${run}%`));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
  void systemSettings;
});

describe("cart", () => {
  it("adds, merges identical lines, re-prices and enforces stock", async () => {
    const g = guest("a");
    await addToCart(g, { variantId: plain.variantId, quantity: 1 });
    const cart = await addToCart(g, { variantId: plain.variantId, quantity: 2 });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.quantity).toBe(3);
    expect(cart.pricing.subtotal).toBe(177_000);
    expect(cart.pricing.shipping).toBe(0); // above the ₹999 threshold
    await expect(addToCart(g, { variantId: scarce.variantId, quantity: 2 })).rejects.toBeInstanceOf(ConflictError);
  });

  it("another shopper can't touch my cart lines (404)", async () => {
    const mine = await getCart(guest("a"));
    await expect(updateCartItem(guest("intruder"), mine.lines[0]!.id, { quantity: 1 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeCartItem({ customerId: customer.userId }, mine.lines[0]!.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("products with required options need a submitted design, priced with its options", async () => {
    const g = guest("d");
    await expect(addToCart(g, { variantId: custom.variantId })).rejects.toBeInstanceOf(ConflictError);
    const d = await createDesign(g, { productId: custom.productId, name: "Mine", config: { options: { shade: "red" } } });
    await expect(addToCart(g, { variantId: custom.variantId, designId: d.id })).rejects.toThrow(/submit/i);
    await submitDesign(g, d.id);
    // Someone else's design reads as missing.
    await expect(addToCart(guest("other"), { variantId: custom.variantId, designId: d.id })).rejects.toBeInstanceOf(ConflictError);
    const cart = await addToCart(g, { variantId: custom.variantId, designId: d.id });
    expect(cart.lines[0]!.unitPrice).toBe(85_000);
    expect(cart.requiresDesignReview).toBe(true);
  });

  it("coupons: unknown codes are rejected, minimum order explained, percent applied", async () => {
    const g = guest("a");
    await expect(applyCartCoupon(g, { code: "NOPE123" })).rejects.toBeInstanceOf(ValidationError);
    const big = await applyCartCoupon(g, { code: `BIG${run}` });
    expect(big.couponError).toMatch(/more to use this code/);
    expect(big.pricing.discount).toBe(0);
    const ten = await applyCartCoupon(g, { code: `ten${run}` });
    expect(ten.pricing.discount).toBe(17_700);
  });

  it("merges a guest cart into the customer's cart on sign-in", async () => {
    const g = guest("m");
    await addToCart(g, { variantId: plain.variantId, quantity: 1 });
    await addToCart({ customerId: customer.userId }, { variantId: plain.variantId, quantity: 1 });
    await mergeGuestCart(customer.userId, g.guestToken);
    const c = await getCart({ customerId: customer.userId });
    expect(c.lines[0]!.quantity).toBe(2);
    expect((await getCart(g)).lines).toHaveLength(0);
  });
});

describe("placing orders", () => {
  it("COD for a customer: totals match the cart, stock reserved, coupon redeemed, cart cleared; idempotent", async () => {
    const me = { customerId: customer.userId };
    await applyCartCoupon(me, { code: `TEN${run}` });
    const cart = await getCart(me);
    const before = await stockOf(plain.variantId);
    const key = randomUUID();
    const placed = await placeOrder(me, { idempotencyKey: key, address, saveAddress: true, paymentMethod: "cod" }, { customer, gateway: null });
    expect(placed.status).toBe("confirmed");
    expect(placed.total).toBe(cart.pricing.total);
    expect((await stockOf(plain.variantId)).reserved).toBe(before.reserved + 2);
    expect((await getCart(me)).lines).toHaveLength(0);
    const [c] = await db.select().from(coupons).where(eq(coupons.code, `TEN${run}`.toUpperCase()));
    expect(c!.usedCount).toBe(1);

    const again = await placeOrder(me, { idempotencyKey: key, address, paymentMethod: "cod" }, { customer, gateway: null });
    expect(again.orderId).toBe(placed.orderId);
    expect((await stockOf(plain.variantId)).reserved).toBe(before.reserved + 2);

    const view = await getOrder(me, placed.orderNumber);
    expect(view.amounts.discount).toBe(cart.pricing.discount);
    // Another customer, or a guest with a made-up token, can't see it.
    await expect(getOrder({ customerId: root }, placed.orderId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getOrder({ orderToken: "x".repeat(32) }, placed.orderId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("never oversells: two shoppers race for the last unit, exactly one wins", async () => {
    const a = guest("race-a");
    const b = guest("race-b");
    await addToCart(a, { variantId: scarce.variantId });
    await addToCart(b, { variantId: scarce.variantId });
    const body = (n: string) => ({ idempotencyKey: randomUUID(), email: `${n}.${run}@example.test`, address, paymentMethod: "cod" as const });
    const results = await Promise.allSettled([placeOrder(a, body("ra"), { gateway: null }), placeOrder(b, body("rb"), { gateway: null })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toBeInstanceOf(ConflictError);
    const s = await stockOf(scarce.variantId);
    expect(s.reserved).toBe(1);
    expect(s.onHand).toBe(1);
  });

  it("guest orders need an email and are readable only with their link token", async () => {
    const g = guest("g1");
    await addToCart(g, { variantId: plain.variantId });
    await expect(placeOrder(g, { idempotencyKey: randomUUID(), address, paymentMethod: "cod" }, { gateway: null })).rejects.toBeInstanceOf(ValidationError);
    const placed = await placeOrder(g, { idempotencyKey: randomUUID(), email: `g1.${run}@example.test`, address, paymentMethod: "cod" }, { gateway: null });
    expect(placed.orderToken).toBeTruthy();
    const view = await getOrder({ orderToken: placed.orderToken! }, placed.orderNumber);
    expect(view.email).toBe(`g1.${run}@example.test`);
  });

  it("guest checkout can be switched off", async () => {
    await updateCheckoutSettings(await ctxOf(root), { ...(await getCheckoutSettings()), guestCheckoutEnabled: false });
    const g = guest("off");
    await addToCart(g, { variantId: plain.variantId });
    await expect(placeOrder(g, { idempotencyKey: randomUUID(), email: `off.${run}@example.test`, address, paymentMethod: "cod" }, { gateway: null })).rejects.toMatchObject({ status: 401 });
    await updateCheckoutSettings(await ctxOf(root), { ...(await getCheckoutSettings()), guestCheckoutEnabled: true });
  });
});

describe("Razorpay", () => {
  it("rejects a forged signature, then confirms a verified payment exactly once", async () => {
    const gw = fakeGateway();
    const g = guest("rz");
    await addToCart(g, { variantId: plain.variantId });
    const placed = await placeOrder(g, { idempotencyKey: randomUUID(), email: `rz.${run}@example.test`, address, paymentMethod: "razorpay" }, { gateway: gw });
    expect(placed.status).toBe("payment_pending");
    expect(placed.payment?.amount).toBe(placed.total + 0);
    const access = { orderToken: placed.orderToken! };
    const { paymentId, signature } = gw.pay(placed.payment!.razorpayOrderId, placed.total);

    await expect(
      verifyRazorpayPayment(access, placed.orderId, { razorpayOrderId: placed.payment!.razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: "0".repeat(64) }, gw),
    ).rejects.toBeInstanceOf(ValidationError);

    const ok = await verifyRazorpayPayment(access, placed.orderId, { razorpayOrderId: placed.payment!.razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signature }, gw);
    expect(ok.status).toBe("confirmed");
    expect(ok.paymentStatus).toBe("captured");
    const twice = await verifyRazorpayPayment(access, placed.orderId, { razorpayOrderId: placed.payment!.razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signature }, gw);
    expect(twice.history.filter((h) => h.note === "Payment received")).toHaveLength(1);
  });

  it("webhooks: bad signature refused; a captured event confirms the order; duplicates are ignored", async () => {
    const gw = fakeGateway();
    const g = guest("wh");
    await addToCart(g, { variantId: plain.variantId });
    const placed = await placeOrder(g, { idempotencyKey: randomUUID(), email: `wh.${run}@example.test`, address, paymentMethod: "razorpay" }, { gateway: gw });
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: `pay_${run}wh`, order_id: placed.payment!.razorpayOrderId, amount: placed.total, status: "captured", method: "card" } } },
    });
    const sig = createHmac("sha256", "whsec").update(body).digest("hex");
    expect((await handleRazorpayWebhook(body, "f".repeat(64), `evt_${run}1`, "whsec")).status).toBe(400);
    expect((await handleRazorpayWebhook(body, sig, `evt_${run}1`, "whsec")).status).toBe(200);
    expect((await handleRazorpayWebhook(body, sig, `evt_${run}1`, "whsec")).body).toBe("duplicate");
    const view = await getOrder({ orderToken: placed.orderToken! }, placed.orderId);
    expect(view.status).toBe("confirmed");
  });

  it("unpaid orders are cancelled after the hold and their stock and coupon use come back", async () => {
    const gw = fakeGateway();
    const me = { customerId: customer.userId };
    await addToCart(me, { variantId: plain.variantId, quantity: 2 });
    await applyCartCoupon(me, { code: `TEN${run}` });
    const before = await stockOf(plain.variantId);
    const [c0] = await db.select().from(coupons).where(eq(coupons.code, `TEN${run}`.toUpperCase()));
    const placed = await placeOrder(me, { idempotencyKey: randomUUID(), address, paymentMethod: "razorpay" }, { customer, gateway: gw });
    expect((await stockOf(plain.variantId)).reserved).toBe(before.reserved + 2);

    const later = new Date(Date.now() + 2 * 24 * 60 * 60_000);
    expect(await releaseExpiredHolds(gw, later)).toBeGreaterThanOrEqual(1);
    const view = await getOrder(me, placed.orderId);
    expect(view.status).toBe("cancelled");
    expect((await stockOf(plain.variantId)).reserved).toBe(before.reserved);
    const [c1] = await db.select().from(coupons).where(eq(coupons.id, c0!.id));
    expect(c1!.usedCount).toBe(c0!.usedCount);
  });

  it("a hold whose payment actually went through is confirmed, not cancelled", async () => {
    const gw = fakeGateway();
    const me = { customerId: customer.userId };
    await addToCart(me, { variantId: plain.variantId });
    const placed = await placeOrder(me, { idempotencyKey: randomUUID(), address, paymentMethod: "razorpay" }, { customer, gateway: gw });
    gw.pay(placed.payment!.razorpayOrderId, placed.total);
    await gw.capturePayment([...(await gw.listOrderPayments(placed.payment!.razorpayOrderId))][0]!.id, placed.total);
    await releaseExpiredHolds(gw, new Date(Date.now() + 2 * 24 * 60 * 60_000));
    expect((await getOrder(me, placed.orderId)).status).toBe("confirmed");
  });
});
