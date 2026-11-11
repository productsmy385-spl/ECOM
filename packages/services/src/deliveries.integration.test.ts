/**
 * Phase 8: deliveries and notifications against the real test DB.
 * Packing creates a delivery and alerts managers; only the assigned captain
 * sees and moves it; pick-up ships the order (stock leaves), delivery of a COD
 * order requires confirming the cash; failures need a reason and can be
 * reattempted; new orders and assignments raise in-app notifications.
 */
import { randomUUID } from "node:crypto";
import { loadActor } from "@ecom/auth";
import { categories, db, deliveries, inventory, inventoryMovements, notifications, orders, payments, products, productVariants, roles, userRoles, users } from "@ecom/db";
import { type Actor, AuthorizationError } from "@ecom/rbac";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addToCart,
  assignDelivery,
  changeOrderStatus,
  ConflictError,
  getDelivery,
  listDeliveries,
  listMyNotifications,
  markNotificationsRead,
  NotFoundError,
  placeOrder,
  updateCheckoutSettings,
  updateDelivery,
  ValidationError,
} from "./index";
import { getCheckoutSettings } from "./settings";

const run = `dl${Date.now().toString(36)}`;
const ctxOf = async (id: string) => ({ actor: (await loadActor(id)) as Actor });
const address = { fullName: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" };

let root: string, captainA: string, captainB: string;
let customer: { userId: string; email: string; name: string };
let variantId: string;
let settingsBefore: Awaited<ReturnType<typeof getCheckoutSettings>>;

async function staff(name: string, role: string) {
  const [u] = await db.insert(users).values({ name, email: `${name.toLowerCase()}.${run}@example.test`, isStaff: true }).returning();
  const [r] = await db.select().from(roles).where(eq(roles.key, role));
  await db.insert(userRoles).values({ userId: u!.id, roleId: r!.id });
  return u!.id;
}

async function packedOrder() {
  const me = { customerId: customer.userId };
  await addToCart(me, { variantId, quantity: 1 });
  const placed = await placeOrder(me, { idempotencyKey: randomUUID(), address, paymentMethod: "cod" }, { customer, gateway: null });
  await changeOrderStatus(await ctxOf(root), placed.orderId, { status: "packed" });
  const [d] = await db.select().from(deliveries).where(eq(deliveries.orderId, placed.orderId));
  return { placed, deliveryId: d!.id };
}

beforeAll(async () => {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  root = r!.id;
  captainA = await staff("CaptA", "delivery_captain");
  captainB = await staff("CaptB", "delivery_captain");
  const [c] = await db.insert(users).values({ name: "Buyer", email: `buyer.${run}@example.test` }).returning();
  customer = { userId: c!.id, email: c!.email, name: c!.name };
  const [cat] = await db.insert(categories).values({ name: `Cat ${run}`, slug: `cat-${run}` }).returning();
  const [p] = await db.insert(products).values({ name: `Frame ${run}`, slug: `frame-${run}`, categoryId: cat!.id, status: "published", publishedAt: new Date() }).returning();
  const [v] = await db.insert(productVariants).values({ productId: p!.id, sku: `${run}-F`.toUpperCase(), name: "8x10", price: 50_000, isDefault: true }).returning();
  await db.insert(inventory).values({ variantId: v!.id, onHand: 10 });
  variantId = v!.id;
  settingsBefore = await getCheckoutSettings();
  await updateCheckoutSettings(await ctxOf(root), { ...settingsBefore, codEnabled: true, codMaxAmount: 10_000_000 });
});

afterAll(async () => {
  await updateCheckoutSettings(await ctxOf(root), settingsBefore);
  const ords = await db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, customer.userId));
  if (ords.length) {
    await db.delete(payments).where(inArray(payments.orderId, ords.map((o) => o.id)));
    await db.delete(orders).where(inArray(orders.id, ords.map((o) => o.id)));
  }
  await db.delete(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
  await db.delete(products).where(like(products.name, `% ${run}`));
  await db.delete(categories).where(like(categories.name, `% ${run}`));
  await db.delete(notifications).where(eq(notifications.userId, root));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
});

describe("delivery lifecycle", () => {
  it("packing creates a delivery; only the assigned captain sees it; COD needs cash confirmation", async () => {
    const { placed, deliveryId } = await packedOrder();
    const a = await ctxOf(captainA);
    const b = await ctxOf(captainB);
    expect((await listDeliveries(a, {})).items.some((d) => d.id === deliveryId)).toBe(false);

    await assignDelivery(await ctxOf(root), deliveryId, { captainId: captainA, instructions: "Call before arriving" });
    const mine = await listDeliveries(a, { open: true });
    expect(mine.items.map((d) => d.id)).toContain(deliveryId);
    expect(mine.items.find((d) => d.id === deliveryId)?.codDue).toBe(placed.total);
    await expect(getDelivery(b, deliveryId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(assignDelivery(a, deliveryId, { captainId: captainB })).rejects.toBeInstanceOf(AuthorizationError);

    const stockBefore = (await db.select().from(inventory).where(eq(inventory.variantId, variantId)))[0]!;
    await expect(updateDelivery(a, deliveryId, { action: "delivered", codCollected: true })).rejects.toBeInstanceOf(ConflictError);
    const picked = await updateDelivery(a, deliveryId, { action: "picked_up" });
    expect(picked.status).toBe("picked_up");
    expect(picked.order.status).toBe("shipped");
    const stockAfter = (await db.select().from(inventory).where(eq(inventory.variantId, variantId)))[0]!;
    expect(stockAfter.onHand).toBe(stockBefore.onHand - 1);

    await updateDelivery(a, deliveryId, { action: "out_for_delivery" });
    await expect(updateDelivery(a, deliveryId, { action: "delivered" })).rejects.toBeInstanceOf(ValidationError);
    const done = await updateDelivery(a, deliveryId, { action: "delivered", codCollected: true, note: "Handed to customer" });
    expect(done.status).toBe("delivered");
    expect(done.order.status).toBe("delivered");
    const [o] = await db.select().from(orders).where(eq(orders.id, placed.orderId));
    expect(o!.paymentStatus).toBe("captured");
    expect(done.history.map((h) => h.to)).toEqual(["assigned", "picked_up", "out_for_delivery", "delivered"]);
  });

  it("a failed attempt needs a reason, alerts managers and can be reattempted", async () => {
    const { deliveryId } = await packedOrder();
    const a = await ctxOf(captainA);
    await assignDelivery(await ctxOf(root), deliveryId, { captainId: captainA });
    await updateDelivery(a, deliveryId, { action: "picked_up" });
    await expect(updateDelivery(a, deliveryId, { action: "failed" })).rejects.toBeInstanceOf(ValidationError);
    const failed = await updateDelivery(a, deliveryId, { action: "failed", note: "Customer not reachable" });
    expect(failed.status).toBe("failed");
    expect(failed.attempts).toBe(1);
    await expect(updateDelivery(a, deliveryId, { action: "reattempt" })).rejects.toBeInstanceOf(AuthorizationError);
    const again = await updateDelivery(await ctxOf(root), deliveryId, { action: "reattempt", note: "Try tomorrow" });
    expect(again.status).toBe("assigned");
  });
});

describe("notifications", () => {
  it("captains hear about assignments; staff about new orders; read state is per user", async () => {
    const a = await listMyNotifications(captainA, { unreadOnly: true });
    expect(a.items.some((n) => n.type === "delivery.assigned" && n.link?.startsWith("/deliveries/"))).toBe(true);
    const rootN = await listMyNotifications(root, { unreadOnly: true });
    expect(rootN.items.some((n) => n.type === "order.new")).toBe(true);
    expect(rootN.items.some((n) => n.type === "delivery.failed")).toBe(true);

    // Captain B can't mark captain A's notification read.
    await expect(markNotificationsRead(captainB, [a.items[0]!.id])).rejects.toBeInstanceOf(NotFoundError);
    await markNotificationsRead(captainA);
    expect((await listMyNotifications(captainA)).unread).toBe(0);
  });
});
