/**
 * Customer engagement against the real test DB: verified-buyer reviews and
 * moderation, cancel / return / buy-again self-service, and support tickets.
 */
import { randomUUID } from "node:crypto";
import { loadActor } from "@ecom/auth";
import { cartItems, carts, categories, db, inventory, inventoryMovements, notifications, orders, payments, products, productVariants, reviews, roles, supportTickets, userRoles, users } from "@ecom/db";
import { type Actor, AuthorizationError } from "@ecom/rbac";
import { eq, inArray, like } from "drizzle-orm";
import { ZodError } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addToCart,
  buyAgain,
  cancelMyOrder,
  changeOrderStatus,
  ConflictError,
  createTicket,
  getMyTicket,
  getTicketAdmin,
  listReviewsAdmin,
  moderateReview,
  myReviewState,
  NotFoundError,
  placeOrder,
  replyMyTicket,
  replyTicketAdmin,
  requestReturn,
  submitReview,
  updateCheckoutSettings,
  updateTicket,
  ValidationError,
} from "./index";
import { getCheckoutSettings } from "./settings";

const run = `en${Date.now().toString(36)}`;
const ctxOf = async (id: string) => ({ actor: (await loadActor(id)) as Actor });
const address = { fullName: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" };

let root: string, agent: string, captain: string;
let buyer: { userId: string; email: string; name: string };
let other: { userId: string; email: string; name: string };
let productId: string, variantId: string;
let settingsBefore: Awaited<ReturnType<typeof getCheckoutSettings>>;

async function staff(name: string, role: string) {
  const [u] = await db.insert(users).values({ name, email: `${name.toLowerCase()}.${run}@example.test`, isStaff: true }).returning();
  const [r] = await db.select().from(roles).where(eq(roles.key, role));
  await db.insert(userRoles).values({ userId: u!.id, roleId: r!.id });
  return u!.id;
}
async function customer(name: string) {
  const [c] = await db.insert(users).values({ name, email: `${name.toLowerCase()}.${run}@example.test` }).returning();
  return { userId: c!.id, email: c!.email, name: c!.name };
}
async function order(who = buyer) {
  const me = { customerId: who.userId };
  await addToCart(me, { variantId, quantity: 1 });
  const p = await placeOrder(me, { idempotencyKey: randomUUID(), address, paymentMethod: "cod" }, { customer: who, gateway: null });
  return p.orderId;
}
async function deliver(orderId: string) {
  const ctx = await ctxOf(root);
  for (const status of ["packed", "shipped", "delivered"]) await changeOrderStatus(ctx, orderId, { status });
}
const reserved = async () => (await db.select({ r: inventory.reserved }).from(inventory).where(eq(inventory.variantId, variantId)))[0]!.r;

beforeAll(async () => {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  root = r!.id;
  agent = await staff("Agent", "customer_support");
  captain = await staff("Capt", "delivery_captain");
  buyer = await customer("Buyer");
  other = await customer("Other");
  const [cat] = await db.insert(categories).values({ name: `Cat ${run}`, slug: `cat-${run}` }).returning();
  const [p] = await db.insert(products).values({ name: `Frame ${run}`, slug: `frame-${run}`, categoryId: cat!.id, status: "published", publishedAt: new Date() }).returning();
  const [v] = await db.insert(productVariants).values({ productId: p!.id, sku: `${run}-E`.toUpperCase(), name: "8x10", price: 60_000, isDefault: true }).returning();
  await db.insert(inventory).values({ variantId: v!.id, onHand: 50 });
  productId = p!.id;
  variantId = v!.id;
  settingsBefore = await getCheckoutSettings();
  await updateCheckoutSettings(await ctxOf(root), { ...settingsBefore, codEnabled: true, codMaxAmount: 10_000_000 });
});

afterAll(async () => {
  await updateCheckoutSettings(await ctxOf(root), settingsBefore);
  const ids = [buyer.userId, other.userId];
  await db.delete(supportTickets).where(inArray(supportTickets.customerId, ids));
  const ords = await db.select({ id: orders.id }).from(orders).where(inArray(orders.customerId, ids));
  if (ords.length) {
    await db.delete(payments).where(inArray(payments.orderId, ords.map((o) => o.id)));
    await db.delete(orders).where(inArray(orders.id, ords.map((o) => o.id)));
  }
  const cs = await db.select({ id: carts.id }).from(carts).where(inArray(carts.userId, ids));
  if (cs.length) await db.delete(cartItems).where(inArray(cartItems.cartId, cs.map((c) => c.id)));
  await db.delete(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
  await db.delete(reviews).where(eq(reviews.productId, productId));
  await db.delete(products).where(like(products.name, `% ${run}`));
  await db.delete(categories).where(like(categories.name, `% ${run}`));
  await db.delete(notifications).where(inArray(notifications.userId, [root, agent]));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
});

describe("reviews", () => {
  it("only verified buyers can review; approval drives the product rating", async () => {
    const me = { userId: buyer.userId };
    const id = await order();
    await expect(submitReview(me, productId, { rating: 5, body: "Lovely frame, great finish" })).rejects.toBeInstanceOf(ConflictError);
    await deliver(id);
    expect((await myReviewState(me, productId)).orderItemId).toBeTruthy();
    await expect(submitReview(me, productId, { rating: 9, body: "x" })).rejects.toBeInstanceOf(ZodError);
    const s = await submitReview(me, productId, { rating: 4, title: "Nice", body: "Lovely frame, great finish" });
    expect(s.review).toMatchObject({ rating: 4, status: "pending" });

    const a = await ctxOf(agent);
    const pending = await listReviewsAdmin(a, { status: "pending" });
    const mine = pending.items.find((r) => r.productId === productId)!;
    expect(mine.verified).toBe(true);
    await expect(moderateReview(await ctxOf(captain), mine.id, { decision: "approved" })).rejects.toBeInstanceOf(AuthorizationError);
    await moderateReview(a, mine.id, { decision: "approved" });
    const [p] = await db.select({ avg: products.ratingAvg, n: products.ratingCount }).from(products).where(eq(products.id, productId));
    expect({ avg: Number(p!.avg), n: p!.n }).toEqual({ avg: 4, n: 1 });

    // Editing sends it back to moderation and out of the average.
    await submitReview(me, productId, { rating: 2, body: "Changed my mind about the colour" });
    const [p2] = await db.select({ n: products.ratingCount }).from(products).where(eq(products.id, productId));
    expect(p2!.n).toBe(0);
  });
});

describe("order self-service", () => {
  it("cancels before production and releases stock; others' orders are 404", async () => {
    const id = await order();
    const before = await reserved();
    await expect(cancelMyOrder({ userId: other.userId }, id, { reason: "Ordered by mistake" })).rejects.toBeInstanceOf(NotFoundError);
    const res = await cancelMyOrder({ userId: buyer.userId }, id, { reason: "Ordered by mistake" });
    expect(res.refundDue).toBe(false);
    const [o] = await db.select({ status: orders.status, reason: orders.cancelReason }).from(orders).where(eq(orders.id, id));
    expect(o!.status).toBe("cancelled");
    expect(o!.reason).toContain("Ordered by mistake");
    expect(await reserved()).toBe(before - 1);
  });

  it("can't cancel once packed", async () => {
    const id = await order();
    await changeOrderStatus(await ctxOf(root), id, { status: "packed" });
    await expect(cancelMyOrder({ userId: buyer.userId }, id, { reason: "Other" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("returns only within the window after delivery, once", async () => {
    const id = await order();
    await expect(requestReturn({ userId: buyer.userId }, id, { reason: "Arrived damaged or broken", details: "Glass was cracked on arrival" })).rejects.toBeInstanceOf(ConflictError);
    await deliver(id);
    await requestReturn({ userId: buyer.userId }, id, { reason: "Arrived damaged or broken", details: "Glass was cracked on arrival" });
    expect((await db.select({ s: orders.status }).from(orders).where(eq(orders.id, id)))[0]!.s).toBe("return_requested");
    await expect(requestReturn({ userId: buyer.userId }, id, { reason: "Other", details: "Trying a second time" })).rejects.toBeInstanceOf(ConflictError);

    const late = await order();
    await deliver(late);
    await db.update(orders).set({ deliveredAt: new Date(Date.now() - 10 * 86_400_000) }).where(eq(orders.id, late));
    await expect(requestReturn({ userId: buyer.userId }, late, { reason: "Other", details: "Too late for this one" })).rejects.toThrow(/within 7 days/);
  });

  it("buy again puts plain items back in the bag", async () => {
    const id = await order(other);
    const r = await buyAgain({ userId: other.userId }, id);
    expect(r.added).toEqual([`Frame ${run}`]);
    await expect(buyAgain({ userId: buyer.userId }, id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("support tickets", () => {
  it("customer ↔ agent conversation with internal notes hidden from the customer", async () => {
    const me = { userId: buyer.userId };
    const [someoneElses] = await db.select({ n: orders.orderNumber }).from(orders).where(eq(orders.customerId, other.userId));
    await expect(createTicket(me, { topic: "Order or delivery", subject: "Where is it", message: "Please check my order", orderNumber: someoneElses!.n })).rejects.toBeInstanceOf(ValidationError);

    const t = await createTicket(me, { topic: "Return or damage", subject: "Cracked glass", message: "The glass was cracked when it arrived." });
    const a = await ctxOf(agent);
    await replyTicketAdmin(a, t.id, { message: "Customer seems genuine, approve return", internal: true });
    const afterReply = await replyTicketAdmin(a, t.id, { message: "Sorry about that! Please send a photo." });
    expect(afterReply.status).toBe("awaiting_customer");
    expect(afterReply.assignee?.id).toBe(agent);
    expect(afterReply.priority).toBe("high");

    const mine = await getMyTicket(me, t.id);
    expect(mine.messages.map((m) => m.body)).toEqual(["The glass was cracked when it arrived.", "Sorry about that! Please send a photo."]);
    expect(mine.messages[1]!.author).toBe("Support team");
    await expect(getMyTicket({ userId: other.userId }, t.id)).rejects.toBeInstanceOf(NotFoundError);

    expect((await replyMyTicket(me, t.id, { message: "Photo attached in email" })).status).toBe("open");
    const resolved = await updateTicket(a, t.id, { status: "resolved" });
    expect(resolved.status).toBe("resolved");
    expect((await getTicketAdmin(a, t.id)).messages).toHaveLength(4);
    await expect(updateTicket(a, t.id, { assignedTo: captain })).rejects.toBeInstanceOf(ValidationError);
    await expect(replyTicketAdmin(await ctxOf(captain), t.id, { message: "hi there" })).rejects.toBeInstanceOf(AuthorizationError);
  });
});
