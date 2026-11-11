/**
 * Deliveries. A delivery is created when an order is packed. Managers with
 * deliveries.assign give it to a captain. Captains (deliveries.update_assigned)
 * move their own deliveries: picked up → out for delivery → delivered or failed.
 * The order moves with it in the same transaction, through the order workflow
 * (stock leaves on pick-up, COD is collected on delivery). A failed attempt
 * goes back to the manager to reattempt.
 */
import { db, deliveries, deliveryAssignments, deliveryStatusHistory, orderItems, orders, permissions, rolePermissions, roles, userRoles, users } from "@ecom/db";
import { type Actor, AuthorizationError, can, requirePermission } from "@ecom/rbac";
import { deliveryAssignSchema, deliveryListQuery, deliveryUpdateSchema, ORDER_TRANSITIONS, type OrderStatusValue, type Paginated, type ShippingAddress } from "@ecom/validation";
import { and, asc, count, desc, eq, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { notifyStaffWith, notifyUsers } from "./notifications";
import { applyOrderTransition, emailCustomerAboutStatus } from "./orders-admin";

type DeliveryStatus = (typeof deliveries.$inferSelect)["status"];

function scope(actor: Actor): SQL | undefined {
  if (can(actor, "deliveries.view")) return undefined;
  if (can(actor, "deliveries.view_assigned")) return eq(deliveries.captainId, actor.userId);
  throw new AuthorizationError();
}

export interface DeliveryListItem {
  id: string;
  orderId: string;
  orderNumber: string;
  status: DeliveryStatus;
  customerName: string;
  phone: string;
  city: string;
  postalCode: string;
  captainName: string | null;
  codDue: number;
  attempts: number;
  updatedAt: Date;
}

const codDue = sql<number>`case when ${orders.paymentProvider} = 'cod' and ${orders.paymentStatus} = 'created' then ${orders.totalAmount} else 0 end`;

export async function listDeliveries(ctx: ServiceContext, raw: unknown): Promise<Paginated<DeliveryListItem>> {
  const q = deliveryListQuery.parse(raw);
  const f: (SQL | undefined)[] = [scope(ctx.actor)];
  if (q.status) f.push(eq(deliveries.status, q.status));
  if (q.open) f.push(notInArray(deliveries.status, ["delivered", "failed"]));
  const where = and(...f);
  const captain = db.$with("captain").as(db.select({ id: users.id, name: users.name }).from(users));
  const [rows, [t]] = await Promise.all([
    db
      .with(captain)
      .select({
        id: deliveries.id,
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        status: deliveries.status,
        customerName: sql<string>`${orders.shippingAddress}->>'fullName'`,
        phone: sql<string>`${orders.shippingAddress}->>'phone'`,
        city: sql<string>`${orders.shippingAddress}->>'city'`,
        postalCode: sql<string>`${orders.shippingAddress}->>'postalCode'`,
        captainName: captain.name,
        codDue,
        attempts: deliveries.attempts,
        updatedAt: deliveries.updatedAt,
      })
      .from(deliveries)
      .innerJoin(orders, eq(orders.id, deliveries.orderId))
      .leftJoin(captain, eq(captain.id, deliveries.captainId))
      .where(where)
      // Active work first, then most recent.
      .orderBy(sql`case ${deliveries.status} when 'out_for_delivery' then 0 when 'picked_up' then 1 when 'assigned' then 2 when 'unassigned' then 3 else 4 end`, desc(deliveries.updatedAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(deliveries).innerJoin(orders, eq(orders.id, deliveries.orderId)).where(where),
  ]);
  const total = t?.n ?? 0;
  return { items: rows as DeliveryListItem[], page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function getDelivery(ctx: ServiceContext, id: string) {
  const [d] = await db
    .select({ d: deliveries, o: orders })
    .from(deliveries)
    .innerJoin(orders, eq(orders.id, deliveries.orderId))
    .where(and(eq(deliveries.id, id), scope(ctx.actor)));
  if (!d) throw new NotFoundError("Delivery not found.");
  const [cap] = d.d.captainId ? await db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(eq(users.id, d.d.captainId)) : [];
  const items = await db.select({ name: orderItems.productName, variant: orderItems.variantName, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, d.o.id));
  const history = await db
    .select({ id: deliveryStatusHistory.id, from: deliveryStatusHistory.fromStatus, to: deliveryStatusHistory.toStatus, note: deliveryStatusHistory.note, actor: users.name, at: deliveryStatusHistory.createdAt })
    .from(deliveryStatusHistory)
    .leftJoin(users, eq(users.id, deliveryStatusHistory.actorId))
    .where(eq(deliveryStatusHistory.deliveryId, id))
    .orderBy(asc(deliveryStatusHistory.createdAt));
  const a = d.o.shippingAddress as ShippingAddress;
  const mine = d.d.captainId === ctx.actor.userId;
  return {
    id: d.d.id,
    status: d.d.status,
    attempts: d.d.attempts,
    instructions: d.d.instructions,
    proofUrl: d.d.proofUrl,
    proofNote: d.d.proofNote,
    failureReason: d.d.failureReason,
    pickedUpAt: d.d.pickedUpAt,
    deliveredAt: d.d.deliveredAt,
    captain: cap ?? null,
    order: {
      id: d.o.id,
      orderNumber: d.o.orderNumber,
      status: d.o.status,
      paymentProvider: d.o.paymentProvider,
      codDue: d.o.paymentProvider === "cod" && d.o.paymentStatus === "created" ? d.o.totalAmount : 0,
      customerNote: d.o.customerNote,
      address: a,
      items,
    },
    mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([a.line1, a.line2, a.landmark, a.city, a.state, a.postalCode].filter(Boolean).join(", "))}`,
    history,
    can: {
      assign: can(ctx.actor, "deliveries.assign"),
      act: can(ctx.actor, "deliveries.update") || (mine && can(ctx.actor, "deliveries.update_assigned")),
    },
  };
}

/** Active delivery captains (anyone who can update assigned deliveries). */
export async function listCaptains(ctx: ServiceContext) {
  requirePermission(ctx.actor, "deliveries.assign");
  return db
    .selectDistinct({ id: users.id, name: users.name, phone: users.phone })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(users.status, "active"), isNull(users.deletedAt), inArray(permissions.key, ["deliveries.update_assigned"])))
    .orderBy(asc(users.name));
}

export async function assignDelivery(ctx: ServiceContext, id: string, raw: unknown) {
  requirePermission(ctx.actor, "deliveries.assign");
  const input = deliveryAssignSchema.parse(raw);
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
    if (!d) throw new NotFoundError("Delivery not found.");
    if (["delivered"].includes(d.status)) throw new ConflictError("This delivery is already complete.");
    if (input.captainId && !(await listCaptains(ctx)).some((c) => c.id === input.captainId)) {
      throw new ValidationError("That person isn't a delivery captain.", { captainId: ["Not a captain"] });
    }
    const now = new Date();
    await tx.update(deliveryAssignments).set({ unassignedAt: now }).where(and(eq(deliveryAssignments.deliveryId, id), isNull(deliveryAssignments.unassignedAt)));
    if (input.captainId) await tx.insert(deliveryAssignments).values({ deliveryId: id, captainId: input.captainId, assignedBy: ctx.actor.userId });
    // Assigning (or reassigning after a failed attempt) restarts from "assigned"; picked-up parcels keep their status.
    const next: DeliveryStatus = !input.captainId ? "unassigned" : ["unassigned", "assigned", "failed"].includes(d.status) ? "assigned" : d.status;
    await tx
      .update(deliveries)
      .set({ captainId: input.captainId, status: next, instructions: input.instructions ?? d.instructions, failureReason: next === "assigned" ? null : d.failureReason, updatedAt: now })
      .where(eq(deliveries.id, id));
    if (next !== d.status) await tx.insert(deliveryStatusHistory).values({ deliveryId: id, fromStatus: d.status, toStatus: next, actorId: ctx.actor.userId, note: input.captainId ? "Captain assigned" : "Unassigned" });
    const [o] = await tx.select({ orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, d.orderId));
    if (input.captainId && input.captainId !== d.captainId) {
      await notifyUsers(tx, [input.captainId], { type: "delivery.assigned", title: `New delivery: ${o?.orderNumber ?? ""}`, body: input.instructions ?? undefined, link: `/deliveries/${id}` });
    }
    await writeAudit(tx, ctx, { action: "delivery.assign", entityType: "delivery", entityId: id, before: { captainId: d.captainId, status: d.status }, after: { captainId: input.captainId, status: next } });
  });
  return getDelivery(ctx, id);
}

const NEXT: Record<string, { from: DeliveryStatus[]; to: DeliveryStatus; order?: OrderStatusValue }> = {
  picked_up: { from: ["assigned"], to: "picked_up", order: "shipped" },
  out_for_delivery: { from: ["picked_up", "in_transit"], to: "out_for_delivery", order: "out_for_delivery" },
  delivered: { from: ["picked_up", "in_transit", "out_for_delivery"], to: "delivered", order: "delivered" },
  failed: { from: ["assigned", "picked_up", "in_transit", "out_for_delivery"], to: "failed" },
};

export async function updateDelivery(ctx: ServiceContext, id: string, raw: unknown) {
  const input = deliveryUpdateSchema.parse(raw);
  const emails: { orderId: string; to: OrderStatusValue }[] = [];
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(deliveries).where(and(eq(deliveries.id, id), scope(ctx.actor))).for("update");
    if (!d) throw new NotFoundError("Delivery not found.");
    const mine = d.captainId === ctx.actor.userId;
    if (!(can(ctx.actor, "deliveries.update") || (mine && can(ctx.actor, "deliveries.update_assigned")))) throw new AuthorizationError();

    const now = new Date();
    if (input.action === "reattempt") {
      if (!can(ctx.actor, "deliveries.assign")) throw new AuthorizationError();
      if (d.status !== "failed") throw new ConflictError("Only failed deliveries can be reattempted.");
      await tx.update(deliveries).set({ status: d.captainId ? "assigned" : "unassigned", failureReason: null, updatedAt: now }).where(eq(deliveries.id, id));
      await tx.insert(deliveryStatusHistory).values({ deliveryId: id, fromStatus: "failed", toStatus: d.captainId ? "assigned" : "unassigned", actorId: ctx.actor.userId, note: input.note ?? "Reattempt" });
      return;
    }
    const rule = NEXT[input.action]!;
    if (!rule.from.includes(d.status)) throw new ConflictError(`A delivery that is "${d.status.replace(/_/g, " ")}" can't be marked "${input.action.replace(/_/g, " ")}".`);
    if (input.action === "failed" && !input.note) throw new ValidationError("Say why the delivery failed.", { note: ["Say why it failed"] });

    const [o] = await tx.select().from(orders).where(eq(orders.id, d.orderId)).for("update");
    if (input.action === "delivered" && o!.paymentProvider === "cod" && o!.paymentStatus === "created" && !input.codCollected) {
      throw new ValidationError(`Collect ₹${(o!.totalAmount / 100).toLocaleString("en-IN")} in cash and confirm it first.`, { codCollected: ["Confirm the cash was collected"] });
    }

    // Move the order with it (skipped if the order is already there, e.g. a manager shipped it by hand).
    if (rule.order && o!.status !== rule.order) {
      if (!(ORDER_TRANSITIONS[o!.status as OrderStatusValue] ?? []).includes(rule.order)) {
        throw new ConflictError(`The order is "${o!.status.replace(/_/g, " ")}", so it can't be marked "${rule.order.replace(/_/g, " ")}" yet.`);
      }
      await applyOrderTransition(tx, ctx, o!, rule.order, input.note ?? null, true);
      emails.push({ orderId: d.orderId, to: rule.order });
    }

    await tx
      .update(deliveries)
      .set({
        status: rule.to,
        updatedAt: now,
        pickedUpAt: rule.to === "picked_up" ? now : d.pickedUpAt,
        deliveredAt: rule.to === "delivered" ? now : d.deliveredAt,
        attempts: input.action === "failed" || input.action === "delivered" ? d.attempts + 1 : d.attempts,
        failureReason: input.action === "failed" ? input.note : d.failureReason,
        proofUrl: input.proofUrl ?? d.proofUrl,
        proofNote: input.action === "delivered" ? (input.note ?? d.proofNote) : d.proofNote,
      })
      .where(eq(deliveries.id, id));
    await tx.insert(deliveryStatusHistory).values({
      deliveryId: id,
      fromStatus: d.status,
      toStatus: rule.to,
      actorId: ctx.actor.userId,
      note: input.note ?? (input.codCollected ? "Cash collected" : null),
      latitude: input.latitude !== undefined ? String(input.latitude) : null,
      longitude: input.longitude !== undefined ? String(input.longitude) : null,
    });
    if (input.action === "failed") {
      await notifyStaffWith(tx, ["deliveries.assign"], { type: "delivery.failed", title: `Delivery failed: ${o!.orderNumber}`, body: input.note ?? undefined, link: `/deliveries/${id}` }, ctx.actor.userId);
    }
    await writeAudit(tx, ctx, { action: `delivery.${input.action}`, entityType: "delivery", entityId: id, before: { status: d.status }, after: { status: rule.to, note: input.note ?? null } });
  });
  for (const e of emails) await emailCustomerAboutStatus(e.orderId, e.to, null);
  return getDelivery(ctx, id);
}

/** Small counts for workspaces and the nav badge. */
export async function myDeliveryCounts(actor: Actor) {
  if (!can(actor, "deliveries.view_assigned") && !can(actor, "deliveries.view")) return null;
  const mine = eq(deliveries.captainId, actor.userId);
  const [r] = await db
    .select({
      active: sql<number>`count(*) filter (where ${deliveries.status} in ('assigned','picked_up','in_transit','out_for_delivery'))::int`,
      unassigned: sql<number>`count(*) filter (where ${deliveries.status} = 'unassigned')::int`,
    })
    .from(deliveries)
    .where(can(actor, "deliveries.view") ? undefined : or(mine));
  return r ?? { active: 0, unassigned: 0 };
}
