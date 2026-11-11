/**
 * Phase 7 operations against the real test DB: order status workflow with
 * stock effects (fulfil on ship, release on cancel, restock on return), COD
 * capture on delivery, refunds (limits, Razorpay via fake gateway, final
 * "refunded" status), assignment-scoped visibility, customers (staff never
 * listed, suspension), purchases (receive adds stock), and the dashboard.
 */
import { randomUUID } from "node:crypto";
import { loadActor } from "@ecom/auth";
import {
  categories,
  couponRedemptions,
  db,
  inventory,
  inventoryMovements,
  orders,
  payments,
  products,
  productVariants,
  purchases,
  refunds,
  roles,
  suppliers,
  userRoles,
  users,
} from "@ecom/db";
import { type Actor, AuthorizationError } from "@ecom/rbac";
import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  actOnPurchase,
  addToCart,
  assignOrder,
  changeOrderStatus,
  ConflictError,
  createPurchase,
  getCustomerAdmin,
  getDashboard,
  getOrderAdmin,
  listCategoriesAdmin,
  listCustomers,
  listOrdersAdmin,
  listProductsAdmin,
  listStock,
  NotFoundError,
  type PaymentGateway,
  placeOrder,
  refundOrder,
  saveSupplier,
  setCustomerStatus,
  updateCheckoutSettings,
  ValidationError,
} from "./index";
import { getCheckoutSettings } from "./settings";

const run = `op${Date.now().toString(36)}`;
const ctxOf = async (id: string) => ({ actor: (await loadActor(id)) as Actor });
const address = { fullName: "Riya Sen", phone: "9876543210", line1: "4 Park St", city: "Kolkata", state: "West Bengal", postalCode: "700016" };

let root: string;
let handler: string; // staff with orders.view_assigned only (Staff role)
let customer: { userId: string; email: string; name: string };
let variantId: string;
let settingsBefore: Awaited<ReturnType<typeof getCheckoutSettings>>;

const stock = async () => (await db.select().from(inventory).where(eq(inventory.variantId, variantId)))[0]!;

async function codOrder() {
  const me = { customerId: customer.userId };
  await addToCart(me, { variantId, quantity: 2 });
  return placeOrder(me, { idempotencyKey: randomUUID(), address, paymentMethod: "cod" }, { customer, gateway: null });
}

beforeAll(async () => {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  root = r!.id;
  const [h] = await db.insert(users).values({ name: "Handler", email: `handler.${run}@example.test`, isStaff: true }).returning();
  const [staffRole] = await db.select().from(roles).where(eq(roles.key, "staff"));
  await db.insert(userRoles).values({ userId: h!.id, roleId: staffRole!.id });
  handler = h!.id;
  const [c] = await db.insert(users).values({ name: "Buyer", email: `buyer.${run}@example.test` }).returning();
  customer = { userId: c!.id, email: c!.email, name: c!.name };
  const [cat] = await db.insert(categories).values({ name: `Cat ${run}`, slug: `cat-${run}` }).returning();
  const [p] = await db.insert(products).values({ name: `Frame ${run}`, slug: `frame-${run}`, categoryId: cat!.id, status: "published", publishedAt: new Date(), taxRateBps: 1200 }).returning();
  const [v] = await db.insert(productVariants).values({ productId: p!.id, sku: `${run}-F`.toUpperCase(), name: "8x10", price: 60_000, isDefault: true }).returning();
  await db.insert(inventory).values({ variantId: v!.id, onHand: 20 });
  variantId = v!.id;
  settingsBefore = await getCheckoutSettings();
  await updateCheckoutSettings(await ctxOf(root), { ...settingsBefore, codEnabled: true, codMaxAmount: 10_000_000 });
});

afterAll(async () => {
  await updateCheckoutSettings(await ctxOf(root), settingsBefore);
  const ords = await db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, customer.userId));
  if (ords.length) {
    const ids = ords.map((o) => o.id);
    await db.delete(refunds).where(inArray(refunds.orderId, ids));
    await db.delete(couponRedemptions).where(inArray(couponRedemptions.orderId, ids));
    await db.delete(payments).where(inArray(payments.orderId, ids));
    await db.delete(orders).where(inArray(orders.id, ids));
  }
  await db.delete(purchases).where(like(purchases.reference, `${run}%`));
  await db.delete(suppliers).where(like(suppliers.name, `% ${run}`));
  await db.delete(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
  await db.delete(products).where(like(products.name, `% ${run}`));
  await db.delete(categories).where(like(categories.name, `% ${run}`));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
});

describe("order workflow", () => {
  it("ship fulfils stock, delivery captures COD, return restocks, full refund ends as refunded", async () => {
    const ctx = await ctxOf(root);
    const placed = await codOrder();
    const s0 = await stock();
    expect(s0.reserved).toBeGreaterThanOrEqual(2);

    await expect(changeOrderStatus(ctx, placed.orderId, { status: "delivered" })).rejects.toBeInstanceOf(ConflictError);
    for (const status of ["packed", "shipped"] as const) await changeOrderStatus(ctx, placed.orderId, { status });
    const s1 = await stock();
    expect(s1.onHand).toBe(s0.onHand - 2);
    expect(s1.reserved).toBe(s0.reserved - 2);

    const delivered = await changeOrderStatus(ctx, placed.orderId, { status: "delivered" });
    expect(delivered.paymentStatus).toBe("captured");
    expect(delivered.refundable).toBe(placed.total);

    await changeOrderStatus(ctx, placed.orderId, { status: "return_requested", note: "Glass cracked" });
    await changeOrderStatus(ctx, placed.orderId, { status: "returned" });
    expect((await stock()).onHand).toBe(s0.onHand);

    await expect(refundOrder(ctx, placed.orderId, { amount: placed.total + 1, reason: "too much" }, null)).rejects.toBeInstanceOf(ValidationError);
    const refunded = await refundOrder(ctx, placed.orderId, { amount: placed.total, reason: "Returned item" }, null);
    expect(refunded.status).toBe("refunded");
    expect(refunded.paymentStatus).toBe("refunded");
    expect(refunded.refundable).toBe(0);
    expect(refunded.history.at(-1)?.to).toBe("refunded");
  });

  it("cancelling needs a reason and releases the reservation", async () => {
    const ctx = await ctxOf(root);
    const placed = await codOrder();
    const before = await stock();
    await expect(changeOrderStatus(ctx, placed.orderId, { status: "cancelled" })).rejects.toBeInstanceOf(ValidationError);
    const o = await changeOrderStatus(ctx, placed.orderId, { status: "cancelled", note: "Customer asked" });
    expect(o.status).toBe("cancelled");
    expect((await stock()).reserved).toBe(before.reserved - 2);
    expect(o.allowedNext).toEqual([]);
  });

  it("online refunds go through the gateway, partially then fully", async () => {
    const ctx = await ctxOf(root);
    const placed = await codOrder();
    // Simulate an online-paid order.
    await db.update(orders).set({ paymentProvider: "razorpay", paymentStatus: "captured" }).where(eq(orders.id, placed.orderId));
    await db.update(payments).set({ provider: "razorpay", status: "captured", razorpayPaymentId: `pay_${run}`, capturedAt: new Date() }).where(eq(payments.orderId, placed.orderId));
    const calls: number[] = [];
    const gw = { refundPayment: async (_id: string, amount: number) => (calls.push(amount), { id: `rfnd_${calls.length}${run}`, status: "processed" }) } as unknown as PaymentGateway;
    const part = await refundOrder(ctx, placed.orderId, { amount: 10_000, reason: "Goodwill" }, gw);
    expect(part.paymentStatus).toBe("partially_refunded");
    expect(part.refundable).toBe(placed.total - 10_000);
    await expect(refundOrder(ctx, placed.orderId, { amount: 10_000, reason: "No keys" }, null)).rejects.toBeInstanceOf(ConflictError);
    expect((await getOrderAdmin(ctx, placed.orderId)).refundable).toBe(placed.total - 10_000); // failed attempt rolled back
    expect(calls).toEqual([10_000]);
  });

  it("assigned-only staff see only their orders; others read as 404", async () => {
    const placed = await codOrder();
    const h = await ctxOf(handler);
    await expect(getOrderAdmin(h, placed.orderId)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listOrdersAdmin(h, {})).items.some((o) => o.id === placed.orderId)).toBe(false);
    await assignOrder(await ctxOf(root), placed.orderId, { staffId: handler });
    expect((await getOrderAdmin(h, placed.orderId)).orderNumber).toBe(placed.orderNumber);
    // The Staff role can view and update, but not cancel or refund.
    await expect(changeOrderStatus(h, placed.orderId, { status: "cancelled", note: "x" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(refundOrder(h, placed.orderId, { amount: 100, reason: "x x" }, null)).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("customers", () => {
  it("lists shoppers, never staff, and suspends", async () => {
    const ctx = await ctxOf(root);
    const list = await listCustomers(ctx, { q: run, pageSize: 50 });
    expect(list.items.map((c) => c.id)).toContain(customer.userId);
    expect(list.items.map((c) => c.id)).not.toContain(handler);
    await expect(getCustomerAdmin(ctx, handler)).rejects.toBeInstanceOf(NotFoundError);
    const detail = await getCustomerAdmin(ctx, customer.userId);
    expect(detail.orderCount).toBeGreaterThan(0);
    expect((await setCustomerStatus(ctx, customer.userId, { active: false })).status).toBe("suspended");
    expect((await loadActor(customer.userId))).toBeNull();
    await setCustomerStatus(ctx, customer.userId, { active: true });
    await expect(listCustomers(await ctxOf(handler), {})).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("inventory", () => {
  it("receiving a purchase adds stock once; a received purchase can't be cancelled", async () => {
    const ctx = await ctxOf(root);
    const sup = await saveSupplier(ctx, null, { name: `Moulding Co ${run}`, gstin: "27ABCDE1234F1Z5" });
    await expect(saveSupplier(ctx, null, { name: `Bad ${run}`, gstin: "123" })).rejects.toMatchObject({ name: "ZodError" });
    const before = await stock();
    const p = await createPurchase(ctx, { supplierId: sup.id, reference: `${run}-PO1`, items: [{ variantId, quantity: 15, unitCost: 25_000 }] });
    expect(p.totalCost).toBe(375_000);
    await actOnPurchase(ctx, p.id, { action: "order" });
    const received = await actOnPurchase(ctx, p.id, { action: "receive" });
    expect(received.status).toBe("received");
    expect((await stock()).onHand).toBe(before.onHand + 15);
    await expect(actOnPurchase(ctx, p.id, { action: "receive" })).rejects.toBeInstanceOf(ConflictError);
    await expect(actOnPurchase(ctx, p.id, { action: "cancel" })).rejects.toBeInstanceOf(ConflictError);
    const rows = await listStock(ctx, { q: run });
    expect(rows.items[0]?.available).toBe((await stock()).onHand - (await stock()).reserved);
  });
});

describe("correlated counts (regression: unqualified column names)", () => {
  it("category product counts and product stock reflect real rows", async () => {
    const ctx = await ctxOf(root);
    const cat = (await listCategoriesAdmin(ctx)).find((c) => c.name === `Cat ${run}`);
    expect(cat?.productCount).toBe(1);
    const prod = (await listProductsAdmin(ctx, { q: `Frame ${run}` })).items[0];
    expect(prod?.variantCount).toBe(1);
    expect(prod?.stock).toBe((await stock()).onHand - (await stock()).reserved);
  });
});

describe("dashboard", () => {
  it("money figures need reports/payments access", async () => {
    const full = await getDashboard(await ctxOf(root));
    expect(full.revenue30?.series).toHaveLength(30);
    const limited = await getDashboard(await ctxOf(handler)).catch((e) => e);
    // The Staff role may lack dashboard.view; if it has it, revenue stays hidden.
    if (limited instanceof Error) expect(limited).toBeInstanceOf(AuthorizationError);
    else expect(limited.revenue30).toBeNull();
    void sql;
  });
});
