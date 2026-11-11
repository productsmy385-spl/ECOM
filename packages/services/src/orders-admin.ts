/**
 * Order operations for staff.
 *  - Visibility: `orders.view` sees all orders; `orders.view_assigned` only
 *    orders assigned to them. Anything else reads as 404.
 *  - Status changes follow ORDER_TRANSITIONS, with stock side effects in the
 *    same transaction: shipping turns reservations into fulfilment, cancelling
 *    releases unfulfilled reservations, a return restocks.
 *  - Refunds go through Razorpay for online payments and are recorded
 *    manually for cash on delivery. Never more than was captured.
 * Every change is audited, and customer-visible history is kept.
 */
import {
  couponRedemptions,
  coupons,
  customerDesigns,
  type DbOrTx,
  deliveries,
  db,
  inventory,
  inventoryMovements,
  orderItems,
  orderNotes,
  orders,
  orderStatusHistory,
  payments,
  permissions,
  refunds,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@ecom/db";
import { type Actor, AuthorizationError, can, canAny, requirePermission } from "@ecom/rbac";
import {
  ORDER_TRANSITIONS,
  orderAssignSchema,
  orderListQuery,
  orderNoteSchema,
  orderStatusChangeSchema,
  type OrderStatusValue,
  type Paginated,
  refundSchema,
  type ShippingAddress,
} from "@ecom/validation";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { emailOrderUpdate, notifyStaffWith, notifyUsers, type OrderEmailKind } from "./notifications";
import { type PaymentGateway, razorpayGateway } from "./razorpay";

const VIEW = ["orders.view", "orders.view_assigned"] as const;

/** Orders this actor may see: all, or only their assigned ones. */
function visibility(actor: Actor): SQL | undefined {
  if (can(actor, "orders.view")) return undefined;
  if (can(actor, "orders.view_assigned")) return eq(orders.assignedStaffId, actor.userId);
  throw new AuthorizationError();
}

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatusValue;
  paymentStatus: string;
  paymentProvider: "razorpay" | "cod";
  customerName: string;
  customerEmail: string | null;
  totalAmount: number;
  itemCount: number;
  requiresDesignReview: boolean;
  assignedStaffName: string | null;
  placedAt: Date;
}

export async function listOrdersAdmin(ctx: ServiceContext, raw: unknown): Promise<Paginated<AdminOrderListItem>> {
  const q = orderListQuery.parse(raw);
  const filters: (SQL | undefined)[] = [visibility(ctx.actor)];
  if (q.status) filters.push(eq(orders.status, q.status));
  if (q.payment) filters.push(eq(orders.paymentStatus, q.payment));
  if (q.method) filters.push(eq(orders.paymentProvider, q.method));
  if (q.from) filters.push(gte(orders.placedAt, new Date(`${q.from}T00:00:00+05:30`)));
  if (q.to) filters.push(lt(orders.placedAt, new Date(new Date(`${q.to}T00:00:00+05:30`).getTime() + 86_400_000)));
  if (q.mine) filters.push(eq(orders.assignedStaffId, ctx.actor.userId));
  if (q.q) {
    const term = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(or(ilike(orders.orderNumber, term), ilike(orders.guestEmail, term), ilike(users.email, term), ilike(users.name, term), sql`${orders.shippingAddress}->>'phone' ilike ${term}`));
  }
  const where = and(...filters);
  const staff = db.$with("staff").as(db.select({ id: users.id, name: users.name }).from(users));
  const [rows, [t]] = await Promise.all([
    db
      .with(staff)
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentProvider: orders.paymentProvider,
        customerName: sql<string>`coalesce(${users.name}, ${orders.shippingAddress}->>'fullName')`,
        customerEmail: sql<string | null>`coalesce(${users.email}, ${orders.guestEmail})`,
        totalAmount: orders.totalAmount,
        itemCount: sql<number>`(select coalesce(sum(quantity), 0)::int from ${orderItems} oi where oi.order_id = "orders"."id")`,
        requiresDesignReview: orders.requiresDesignReview,
        assignedStaffName: staff.name,
        placedAt: orders.placedAt,
      })
      .from(orders)
      .leftJoin(users, eq(users.id, orders.customerId))
      .leftJoin(staff, eq(staff.id, orders.assignedStaffId))
      .where(where)
      .orderBy(desc(orders.placedAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(orders).leftJoin(users, eq(users.id, orders.customerId)).where(where),
  ]);
  const total = t?.n ?? 0;
  return { items: rows as AdminOrderListItem[], page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatusValue;
  allowedNext: OrderStatusValue[];
  paymentStatus: string;
  paymentProvider: "razorpay" | "cod";
  placedAt: Date;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  customer: { id: string | null; name: string; email: string | null; phone: string | null; isGuest: boolean };
  shippingAddress: ShippingAddress;
  shippingMethod: string;
  customerNote: string | null;
  couponCode: string | null;
  amounts: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  requiresDesignReview: boolean;
  designsPending: number;
  assignedStaff: { id: string; name: string } | null;
  items: {
    id: string;
    productId: string;
    productName: string;
    variantName: string;
    sku: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    customizationPrice: number;
    taxRateBps: number;
    taxAmount: number;
    lineTotal: number;
    summary: { label: string; value: string }[];
    designId: string | null;
    designStatus: string | null;
  }[];
  payments: { id: string; provider: string; status: string; amount: number; refundedAmount: number; method: string | null; razorpayPaymentId: string | null; capturedAt: Date | null; failureReason: string | null }[];
  refunds: { id: string; amount: number; status: string; reason: string | null; createdAt: Date; razorpayRefundId: string | null }[];
  refundable: number;
  history: { id: string; from: string | null; to: string; note: string | null; actor: string | null; customerVisible: boolean; at: Date }[];
  notes: { id: string; body: string; author: string | null; at: Date }[];
  fulfilled: boolean;
}

async function loadOrderRow(conn: DbOrTx, actor: Actor, id: string, lock = false) {
  const q = conn.select().from(orders).where(and(eq(orders.id, id), visibility(actor)));
  const [o] = lock ? await q.for("update") : await q;
  if (!o) throw new NotFoundError("Order not found.");
  return o;
}

async function isFulfilled(conn: DbOrTx, orderId: string) {
  const [r] = await conn
    .select({ n: count() })
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.referenceType, "order"), eq(inventoryMovements.referenceId, orderId), eq(inventoryMovements.type, "fulfillment")));
  return (r?.n ?? 0) > 0;
}

export async function getOrderAdmin(ctx: ServiceContext, id: string): Promise<AdminOrderDetail> {
  return buildDetail(db, ctx.actor, id);
}

async function buildDetail(conn: DbOrTx, actor: Actor, id: string): Promise<AdminOrderDetail> {
  const o = await loadOrderRow(conn, actor, id);
  const [cust] = o.customerId ? await conn.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users).where(eq(users.id, o.customerId)) : [];
  const [assigned] = o.assignedStaffId ? await conn.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, o.assignedStaffId)) : [];
  const items = await conn
    .select({ i: orderItems, designStatus: customerDesigns.status })
    .from(orderItems)
    .leftJoin(customerDesigns, eq(customerDesigns.id, orderItems.designId))
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.createdAt));
  const pays = await conn.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.createdAt));
  const refs = await conn.select().from(refunds).where(eq(refunds.orderId, id)).orderBy(desc(refunds.createdAt));
  const hist = await conn
    .select({ h: orderStatusHistory, actor: users.name })
    .from(orderStatusHistory)
    .leftJoin(users, eq(users.id, orderStatusHistory.actorId))
    .where(eq(orderStatusHistory.orderId, id))
    .orderBy(asc(orderStatusHistory.createdAt));
  const notes = await conn
    .select({ n: orderNotes, author: users.name })
    .from(orderNotes)
    .leftJoin(users, eq(users.id, orderNotes.authorId))
    .where(eq(orderNotes.orderId, id))
    .orderBy(desc(orderNotes.createdAt));
  const addr = o.shippingAddress as ShippingAddress;
  const captured = pays.filter((p) => ["captured", "partially_refunded"].includes(p.status));
  const designsPending = items.filter((r) => r.i.requiresDesignReview && r.designStatus !== "approved").length;
  const status = o.status as OrderStatusValue;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status,
    allowedNext: ORDER_TRANSITIONS[status] ?? [],
    paymentStatus: o.paymentStatus,
    paymentProvider: o.paymentProvider,
    placedAt: o.placedAt,
    confirmedAt: o.confirmedAt,
    deliveredAt: o.deliveredAt,
    cancelledAt: o.cancelledAt,
    cancelReason: o.cancelReason,
    customer: cust
      ? { id: cust.id, name: cust.name, email: cust.email, phone: cust.phone ?? addr.phone ?? null, isGuest: false }
      : { id: null, name: addr.fullName, email: o.guestEmail, phone: o.guestPhone ?? addr.phone ?? null, isGuest: true },
    shippingAddress: addr,
    shippingMethod: o.shippingMethod,
    customerNote: o.customerNote,
    couponCode: o.couponCode,
    amounts: { subtotal: o.subtotal, discount: o.discountAmount, shipping: o.shippingAmount, tax: o.taxAmount, total: o.totalAmount },
    requiresDesignReview: o.requiresDesignReview,
    designsPending,
    assignedStaff: assigned ?? null,
    items: items.map(({ i, designStatus }) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      variantName: i.variantName,
      sku: i.sku,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      customizationPrice: i.customizationPrice,
      taxRateBps: i.taxRateBps,
      taxAmount: i.taxAmount,
      lineTotal: i.lineTotal,
      summary: ((i.customization as { summary?: { label: string; value: string }[] } | null)?.summary ?? []).map(({ label, value }) => ({ label, value })),
      designId: i.designId,
      designStatus: designStatus ?? null,
    })),
    payments: pays.map((p) => ({ id: p.id, provider: p.provider, status: p.status, amount: p.amount, refundedAmount: p.refundedAmount, method: p.method, razorpayPaymentId: p.razorpayPaymentId, capturedAt: p.capturedAt, failureReason: p.failureReason })),
    refunds: refs.map((r) => ({ id: r.id, amount: r.amount, status: r.status, reason: r.reason, createdAt: r.createdAt, razorpayRefundId: r.razorpayRefundId })),
    refundable: captured.reduce((a, p) => a + p.amount - p.refundedAmount, 0),
    history: hist.map(({ h, actor: a }) => ({ id: h.id, from: h.fromStatus, to: h.toStatus, note: h.note, actor: a, customerVisible: h.isCustomerVisible, at: h.createdAt })),
    notes: notes.map(({ n, author }) => ({ id: n.id, body: n.body, author, at: n.createdAt })),
    fulfilled: await isFulfilled(conn, o.id),
  };
}

// ----------------------------------------------------------- stock effects

async function itemsPerVariant(conn: DbOrTx, orderId: string) {
  const items = await conn.select({ variantId: orderItems.variantId, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const m = new Map<string, number>();
  for (const i of items) m.set(i.variantId, (m.get(i.variantId) ?? 0) + i.quantity);
  return [...m].sort(([a], [b]) => a.localeCompare(b));
}

async function moveStock(conn: DbOrTx, ctx: ServiceContext, orderId: string, orderNumber: string, kind: "fulfillment" | "release" | "return") {
  for (const [variantId, qty] of await itemsPerVariant(conn, orderId)) {
    if (kind === "fulfillment") {
      await conn.update(inventory).set({ onHand: sql`${inventory.onHand} - ${qty}`, reserved: sql`greatest(${inventory.reserved} - ${qty}, 0)`, updatedAt: new Date() }).where(eq(inventory.variantId, variantId));
    } else if (kind === "release") {
      await conn.update(inventory).set({ reserved: sql`greatest(${inventory.reserved} - ${qty}, 0)`, updatedAt: new Date() }).where(eq(inventory.variantId, variantId));
    } else {
      await conn.update(inventory).set({ onHand: sql`${inventory.onHand} + ${qty}`, updatedAt: new Date() }).where(eq(inventory.variantId, variantId));
    }
    await conn.insert(inventoryMovements).values({
      variantId,
      type: kind,
      onHandDelta: kind === "fulfillment" ? -qty : kind === "return" ? qty : 0,
      reservedDelta: kind === "return" ? 0 : -qty,
      referenceType: "order",
      referenceId: orderId,
      note: orderNumber,
      actorId: ctx.actor.userId,
    });
  }
}

// ----------------------------------------------------------- status change

type OrderRow = typeof orders.$inferSelect;
const EMAIL_ON: Partial<Record<OrderStatusValue, OrderEmailKind>> = { shipped: "shipped", out_for_delivery: "out_for_delivery", delivered: "delivered", cancelled: "cancelled" };

/**
 * Internal: validates and applies one status move with all its effects.
 * Callers have already checked the caller's permission and locked the row.
 * Used by changeOrderStatus (staff) and by deliveries (captains).
 */
export async function applyOrderTransition(tx: DbOrTx, ctx: ServiceContext, o: OrderRow, to: OrderStatusValue, note: string | null, visible: boolean) {
  const id = o.id;
  const from = o.status as OrderStatusValue;
  if (!(ORDER_TRANSITIONS[from] ?? []).includes(to)) {
    throw new ConflictError(`An order that is "${from.replace(/_/g, " ")}" can't move to "${to.replace(/_/g, " ")}".`);
  }
  if (to === "design_approved" || (from === "confirmed" && to === "production" && o.requiresDesignReview)) {
    const pending = await tx
      .select({ n: count() })
      .from(orderItems)
      .leftJoin(customerDesigns, eq(customerDesigns.id, orderItems.designId))
      .where(and(eq(orderItems.orderId, id), eq(orderItems.requiresDesignReview, true), sql`coalesce(${customerDesigns.status}::text, '') <> 'approved'`));
    if ((pending[0]?.n ?? 0) > 0) throw new ConflictError("Some designs in this order haven't been approved yet. Approve them in Designs first.");
  }
  if (to === "cancelled" && !note) throw new ValidationError("Give a reason for cancelling.", { note: ["Give a reason for cancelling"] });

  const now = new Date();
  const fulfilled = await isFulfilled(tx, id);
  const set: Partial<typeof orders.$inferInsert> = { status: to, updatedAt: now };

  if (to === "shipped" && !fulfilled) await moveStock(tx, ctx, id, o.orderNumber, "fulfillment");
  if (to === "cancelled") {
    if (!fulfilled) await moveStock(tx, ctx, id, o.orderNumber, "release");
    set.cancelledAt = now;
    set.cancelReason = note;
    const [red] = await tx.delete(couponRedemptions).where(eq(couponRedemptions.orderId, id)).returning();
    if (red) await tx.update(coupons).set({ usedCount: sql`greatest(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.id, red.couponId));
    if (o.paymentProvider === "cod" && o.paymentStatus === "created") {
      await tx.update(payments).set({ status: "failed", failureReason: "Order cancelled before delivery", updatedAt: now }).where(eq(payments.orderId, id));
    }
    await tx.update(deliveries).set({ status: "failed", failureReason: "Order cancelled", updatedAt: now }).where(and(eq(deliveries.orderId, id), sql`${deliveries.status} <> 'delivered'`));
  }
  if (to === "delivered") {
    set.deliveredAt = now;
    if (o.paymentProvider === "cod" && o.paymentStatus === "created") {
      // Cash collected on delivery.
      set.paymentStatus = "captured";
      await tx.update(payments).set({ status: "captured", capturedAt: now, verifiedAt: now, method: "cash", updatedAt: now }).where(eq(payments.orderId, id));
    }
  }
  if (to === "returned") await moveStock(tx, ctx, id, o.orderNumber, "return");
  if (to === "packed") {
    // Packed orders get a delivery to assign to a captain.
    const created = await tx.insert(deliveries).values({ orderId: id }).onConflictDoNothing().returning({ id: deliveries.id });
    if (created.length) {
      await notifyStaffWith(tx, ["deliveries.assign"], { type: "delivery.unassigned", title: `${o.orderNumber} is packed`, body: "Assign a delivery captain.", link: `/deliveries/${created[0]!.id}` }, ctx.actor.userId);
    }
  }

  await tx.update(orders).set(set).where(eq(orders.id, id));
  await tx.insert(orderStatusHistory).values({ orderId: id, fromStatus: from, toStatus: to, actorId: ctx.actor.userId, note, isCustomerVisible: visible });
  await writeAudit(tx, ctx, { action: "order.status", entityType: "order", entityId: id, before: { status: from }, after: { status: to, note } });
}

/** After commit: tell the customer by email (only for customer-visible updates). */
export async function emailCustomerAboutStatus(orderId: string, to: OrderStatusValue, note: string | null) {
  const kind = EMAIL_ON[to];
  if (!kind) return;
  const [o] = await db
    .select({ orderNumber: orders.orderNumber, total: orders.totalAmount, guestEmail: orders.guestEmail, email: users.email, customerId: orders.customerId })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.customerId))
    .where(eq(orders.id, orderId));
  if (!o) return;
  await emailOrderUpdate(kind, { orderNumber: o.orderNumber, to: o.email ?? o.guestEmail, total: o.total, link: o.customerId ? `/orders/${o.orderNumber}` : null, note });
}

export async function changeOrderStatus(ctx: ServiceContext, id: string, raw: unknown): Promise<AdminOrderDetail> {
  const input = orderStatusChangeSchema.parse(raw);
  const needed = input.status === "cancelled" ? "orders.cancel" : "orders.update";
  requirePermission(ctx.actor, needed);
  if (!canAny(ctx.actor, [...VIEW])) throw new AuthorizationError();

  const detail = await db.transaction(async (tx) => {
    const o = await loadOrderRow(tx, ctx.actor, id, true);
    await applyOrderTransition(tx, ctx, o, input.status, input.note ?? null, input.notifyCustomer);
    return buildDetail(tx, ctx.actor, id);
  });
  if (input.notifyCustomer) await emailCustomerAboutStatus(id, input.status, input.note ?? null);
  return detail;
}

export async function addOrderNote(ctx: ServiceContext, id: string, raw: unknown) {
  requirePermission(ctx.actor, "orders.update");
  const { body } = orderNoteSchema.parse(raw);
  await loadOrderRow(db, ctx.actor, id);
  await db.insert(orderNotes).values({ orderId: id, authorId: ctx.actor.userId, body });
  return getOrderAdmin(ctx, id);
}

/** Staff who can be assigned orders (hold an orders.* view permission and are active). */
export async function listOrderAssignees(ctx: ServiceContext) {
  requirePermission(ctx.actor, "orders.assign");
  return db
    .selectDistinct({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(users.status, "active"), sql`${users.deletedAt} is null`, or(eq(roles.key, "super_admin"), inArray(permissions.key, [...VIEW]))))
    .orderBy(asc(users.name));
}

export async function assignOrder(ctx: ServiceContext, id: string, raw: unknown) {
  requirePermission(ctx.actor, "orders.assign");
  const { staffId } = orderAssignSchema.parse(raw);
  return db.transaction(async (tx) => {
    const o = await loadOrderRow(tx, ctx.actor, id, true);
    if (staffId) {
      const ok = (await listOrderAssignees(ctx)).some((s) => s.id === staffId);
      if (!ok) throw new ValidationError("That person can't take orders.", { staffId: ["Not an order handler"] });
    }
    await tx.update(orders).set({ assignedStaffId: staffId, updatedAt: new Date() }).where(eq(orders.id, id));
    if (staffId && staffId !== ctx.actor.userId) {
      await notifyUsers(tx, [staffId], { type: "order.assigned", title: `${o.orderNumber} was assigned to you`, link: `/orders/${id}` });
    }
    await writeAudit(tx, ctx, { action: "order.assign", entityType: "order", entityId: id, before: { staffId: o.assignedStaffId }, after: { staffId } });
    return buildDetail(tx, ctx.actor, id);
  });
}

// ----------------------------------------------------------------- refunds

export async function refundOrder(ctx: ServiceContext, id: string, raw: unknown, gateway: PaymentGateway | null = razorpayGateway()): Promise<AdminOrderDetail> {
  requirePermission(ctx.actor, "payments.refund");
  const input = refundSchema.parse(raw);
  const now = new Date();
  // Lock and validate first; call Razorpay outside the transaction; then record.
  const target = await db.transaction(async (tx) => {
    await loadOrderRow(tx, ctx.actor, id, true);
    const [p] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, id), inArray(payments.status, ["captured", "partially_refunded"])))
      .orderBy(desc(payments.createdAt))
      .limit(1)
      .for("update");
    if (!p) throw new ConflictError("There's no captured payment to refund on this order.");
    const left = p.amount - p.refundedAmount;
    if (input.amount > left) throw new ValidationError(`You can refund at most ${(left / 100).toFixed(2)}.`, { amount: ["More than what's refundable"] });
    const [r] = await tx.insert(refunds).values({ paymentId: p.id, orderId: id, amount: input.amount, reason: input.reason, status: "processing", requestedBy: ctx.actor.userId, approvedBy: ctx.actor.userId }).returning();
    // Reserve the amount now, so two concurrent refunds can't exceed the payment.
    await tx.update(payments).set({ refundedAmount: sql`${payments.refundedAmount} + ${input.amount}`, updatedAt: now }).where(eq(payments.id, p.id));
    return { payment: p, refund: r! };
  });

  let gatewayRef: { id: string; status: string } | null = null;
  try {
    if (target.payment.provider === "razorpay") {
      if (!gateway || !target.payment.razorpayPaymentId) throw new ConflictError("Online refunds need the Razorpay keys configured.");
      gatewayRef = await gateway.refundPayment(target.payment.razorpayPaymentId, input.amount, { orderId: id, reason: input.reason.slice(0, 200) });
    }
  } catch (err) {
    // Undo the reservation and mark the refund failed.
    await db.transaction(async (tx) => {
      await tx.update(payments).set({ refundedAmount: sql`${payments.refundedAmount} - ${input.amount}`, updatedAt: new Date() }).where(eq(payments.id, target.payment.id));
      await tx.update(refunds).set({ status: "failed", updatedAt: new Date() }).where(eq(refunds.id, target.refund.id));
    });
    throw err;
  }

  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, target.payment.id)).for("update");
    const full = p!.refundedAmount >= p!.amount;
    await tx.update(payments).set({ status: full ? "refunded" : "partially_refunded", updatedAt: new Date() }).where(eq(payments.id, p!.id));
    await tx.update(refunds).set({ status: "processed", razorpayRefundId: gatewayRef?.id ?? null, processedAt: new Date(), updatedAt: new Date() }).where(eq(refunds.id, target.refund.id));
    const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    const orderSet: Partial<typeof orders.$inferInsert> = { paymentStatus: full ? "refunded" : "partially_refunded", updatedAt: new Date() };
    if (full && ["cancelled", "returned"].includes(o!.status)) {
      orderSet.status = "refunded";
      await tx.insert(orderStatusHistory).values({ orderId: id, fromStatus: o!.status, toStatus: "refunded", actorId: ctx.actor.userId, note: "Refund issued" });
    }
    await tx.update(orders).set(orderSet).where(eq(orders.id, id));
    await writeAudit(tx, ctx, {
      action: "payment.refund",
      entityType: "order",
      entityId: id,
      after: { amount: input.amount, reason: input.reason, provider: target.payment.provider, razorpayRefundId: gatewayRef?.id ?? null },
    });
    return buildDetail(tx, ctx.actor, id);
  });
}

// --------------------------------------------------------------- payments

export async function listPaymentsAdmin(ctx: ServiceContext, raw: unknown) {
  requirePermission(ctx.actor, "payments.view");
  const q = orderListQuery.pick({ q: true, page: true, pageSize: true }).parse(raw);
  const where = q.q ? or(ilike(orders.orderNumber, `%${q.q}%`), ilike(payments.razorpayPaymentId, `%${q.q}%`)) : undefined;
  const [rows, [t]] = await Promise.all([
    db
      .select({
        id: payments.id,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        provider: payments.provider,
        status: payments.status,
        amount: payments.amount,
        refundedAmount: payments.refundedAmount,
        method: payments.method,
        razorpayPaymentId: payments.razorpayPaymentId,
        capturedAt: payments.capturedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(where),
  ]);
  const total = t?.n ?? 0;
  return { items: rows, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}
