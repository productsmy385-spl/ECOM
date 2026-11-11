/**
 * Order self-service for signed-in customers (Amazon/Flipkart style):
 * cancel before production starts, request a return within the return
 * window after delivery, and buy again. State changes go through the same
 * applyOrderTransition as staff, so stock, coupons, deliveries and the audit
 * trail behave identically.
 */
import { db, orderItems, orders } from "@ecom/db";
import type { Actor } from "@ecom/rbac";
import { orderCancelSchema, orderReturnSchema, RETURN_WINDOW_DAYS } from "@ecom/validation";
import { and, eq } from "drizzle-orm";
import type { CustomerContext } from "./account";
import { addToCart } from "./cart";
import type { ServiceContext } from "./context";
import { ConflictError, NotFoundError } from "./errors";
import { notifyStaffWith } from "./notifications";
import { applyOrderTransition, emailCustomerAboutStatus } from "./orders-admin";

/** Statuses a customer may still cancel from (nothing has been made yet). */
export const CUSTOMER_CANCELLABLE = ["pending", "payment_pending", "confirmed", "design_review", "design_approved"] as const;

export interface OrderSelfService {
  canCancel: boolean;
  canReturn: boolean;
  /** Last moment a return can be requested (null when not delivered). */
  returnBy: Date | null;
}

export function orderSelfService(o: { status: string; deliveredAt: Date | null }, now = new Date()): OrderSelfService {
  const returnBy = o.deliveredAt ? new Date(o.deliveredAt.getTime() + RETURN_WINDOW_DAYS * 86_400_000) : null;
  return {
    canCancel: (CUSTOMER_CANCELLABLE as readonly string[]).includes(o.status),
    canReturn: o.status === "delivered" && !!returnBy && returnBy > now,
    returnBy,
  };
}

/** The customer acts as themselves (no staff permissions) in the shared order workflow. */
function customerCtx(c: CustomerContext, req?: { ip?: string | null; userAgent?: string | null }): ServiceContext {
  const actor: Actor = { userId: c.userId, roles: [], permissions: new Set() };
  return { actor, ip: req?.ip ?? null, userAgent: req?.userAgent ?? null };
}

async function lockMyOrder(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], c: CustomerContext, orderId: string) {
  const [o] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, c.userId))).for("update");
  if (!o) throw new NotFoundError("Order not found.");
  return o;
}

export async function cancelMyOrder(c: CustomerContext, orderId: string, raw: unknown, req?: { ip?: string | null; userAgent?: string | null }) {
  const input = orderCancelSchema.parse(raw);
  const note = `Cancelled by customer: ${input.reason}${input.details ? `. ${input.details}` : ""}`;
  const ctx = customerCtx(c, req);
  const o = await db.transaction(async (tx) => {
    const o = await lockMyOrder(tx, c, orderId);
    if (!orderSelfService(o).canCancel) throw new ConflictError("This order can no longer be cancelled online: it's already being made or on its way. Contact us and we'll help.");
    await applyOrderTransition(tx, ctx, o, "cancelled", note, true);
    const paid = o.paymentStatus === "captured" || o.paymentStatus === "partially_refunded";
    await notifyStaffWith(
      tx,
      paid ? ["payments.refund"] : ["orders.update"],
      { type: "order.cancelled_by_customer", title: `${o.orderNumber} cancelled by the customer`, body: paid ? "Paid online: issue the refund." : input.reason, link: `/orders/${o.id}` },
      null,
    );
    return o;
  });
  await emailCustomerAboutStatus(o.id, "cancelled", note).catch(() => {});
  return { ok: true, refundDue: o.paymentStatus === "captured" || o.paymentStatus === "partially_refunded" };
}

export async function requestReturn(c: CustomerContext, orderId: string, raw: unknown, req?: { ip?: string | null; userAgent?: string | null }) {
  const input = orderReturnSchema.parse(raw);
  const note = `Return requested: ${input.reason}. ${input.details}`;
  const ctx = customerCtx(c, req);
  await db.transaction(async (tx) => {
    const o = await lockMyOrder(tx, c, orderId);
    if (!orderSelfService(o).canReturn) {
      throw new ConflictError(o.status === "delivered" ? `Returns can be requested within ${RETURN_WINDOW_DAYS} days of delivery.` : "Returns can be requested once the order is delivered.");
    }
    await applyOrderTransition(tx, ctx, o, "return_requested", note, true);
    await notifyStaffWith(tx, ["orders.update"], { type: "order.return_requested", title: `Return requested on ${o.orderNumber}`, body: input.reason, link: `/orders/${o.id}` }, null);
  });
  return { ok: true };
}

/** Adds the order's plain items back to the bag. Custom-designed items are skipped (they're one of a kind). */
export async function buyAgain(c: CustomerContext, orderId: string) {
  const [o] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, c.userId)));
  if (!o) throw new NotFoundError("Order not found.");
  const items = await db.select({ variantId: orderItems.variantId, quantity: orderItems.quantity, designId: orderItems.designId, name: orderItems.productName }).from(orderItems).where(eq(orderItems.orderId, o.id));
  const added: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const i of items) {
    if (i.designId) {
      skipped.push({ name: i.name, reason: "Custom design: open the product to design a new one" });
      continue;
    }
    try {
      await addToCart({ customerId: c.userId }, { variantId: i.variantId, quantity: i.quantity });
      added.push(i.name);
    } catch (err) {
      skipped.push({ name: i.name, reason: (err as Error).message || "Not available" });
    }
  }
  return { added, skipped };
}
