/**
 * Notifications.
 *  - In-app (staff): rows in `notifications`, shown by the admin bell.
 *  - Email (customers): order updates through Resend (`sendEmail` logs
 *    instead of sending when RESEND_API_KEY is missing). Emails go out
 *    after the transaction commits and never fail the business action.
 */
import { sendEmail, simpleEmail } from "@ecom/auth";
import { type DbOrTx, db, notifications, permissions, rolePermissions, roles, userRoles, users } from "@ecom/db";
import type { Permission } from "@ecom/rbac";
import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { NotFoundError } from "./errors";

export interface NotificationInput {
  type: string;
  title: string;
  body?: string | null;
  /** Admin-relative link, e.g. /orders/<id>. */
  link?: string | null;
  data?: Record<string, unknown> | null;
}

export async function notifyUsers(conn: DbOrTx, userIds: (string | null | undefined)[], n: NotificationInput) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return 0;
  await conn.insert(notifications).values(ids.map((userId) => ({ userId, channel: "in_app" as const, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, data: n.data ?? null })));
  return ids.length;
}

/** Active staff holding ANY of the permissions (Super Admins included). */
export async function staffWith(conn: DbOrTx, perms: Permission[]) {
  const rows = await conn
    .selectDistinct({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(users.status, "active"), isNull(users.deletedAt), or(eq(roles.key, "super_admin"), inArray(permissions.key, perms))));
  return rows.map((r) => r.id);
}

export async function notifyStaffWith(conn: DbOrTx, perms: Permission[], n: NotificationInput, exclude?: string | null) {
  const ids = (await staffWith(conn, perms)).filter((id) => id !== exclude);
  return notifyUsers(conn, ids, n);
}

// ----------------------------------------------------------------- reading

export async function listMyNotifications(userId: string, { unreadOnly = false, limit = 30 } = {}) {
  const where = and(eq(notifications.userId, userId), eq(notifications.channel, "in_app"), unreadOnly ? isNull(notifications.readAt) : undefined);
  const [items, [u]] = await Promise.all([
    db
      .select({ id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body, link: notifications.link, readAt: notifications.readAt, createdAt: notifications.createdAt })
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(Math.min(limit, 100)),
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.channel, "in_app"), isNull(notifications.readAt))),
  ]);
  return { items, unread: u?.n ?? 0 };
}

/** Marks the caller's notifications read (all, or the given ids). Other users' ids are ignored. */
export async function markNotificationsRead(userId: string, ids?: string[]) {
  const res = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), ids?.length ? inArray(notifications.id, ids) : undefined))
    .returning({ id: notifications.id });
  if (ids?.length === 1 && res.length === 0) {
    const [own] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.id, ids[0]!), eq(notifications.userId, userId)));
    if (!own) throw new NotFoundError("Notification not found.");
  }
  return { updated: res.length };
}

// ---------------------------------------------------------- customer email

export type OrderEmailKind = "placed" | "paid" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "refunded";

const COPY: Record<OrderEmailKind, { subject: (n: string) => string; title: string; body: string }> = {
  placed: { subject: (n) => `Order ${n} confirmed`, title: "Thank you for your order!", body: "We've received your order and will start on it right away. Custom pieces are checked by our designers before production." },
  paid: { subject: (n) => `Payment received for ${n}`, title: "Payment received", body: "Your payment went through and your order is confirmed." },
  shipped: { subject: (n) => `${n} has shipped`, title: "Your order is on its way", body: "Your frames have left our studio." },
  out_for_delivery: { subject: (n) => `${n} is out for delivery`, title: "Out for delivery today", body: "Our delivery partner is on the way. Please keep your phone handy." },
  delivered: { subject: (n) => `${n} delivered`, title: "Delivered!", body: "We hope you love it. Reply to this email if anything isn't right." },
  cancelled: { subject: (n) => `${n} cancelled`, title: "Your order was cancelled", body: "If you paid online, any refund is issued to your original payment method." },
  refunded: { subject: (n) => `Refund issued for ${n}`, title: "Refund issued", body: "Your refund has been issued. Banks usually take 5–7 working days to show it." },
};

/**
 * Emails the customer about an order. `to` is the account email or the guest
 * email. Fire-and-forget: errors are logged, never thrown.
 */
export async function emailOrderUpdate(kind: OrderEmailKind, o: { orderNumber: string; to: string | null; total?: number; link?: string | null; note?: string | null }) {
  if (!o.to) return;
  const c = COPY[kind];
  const web = process.env.WEB_URL ?? "";
  const url = o.link ? (o.link.startsWith("http") ? o.link : `${web}${o.link}`) : `${web}/account/orders`;
  const body = [c.body, o.note ? `Note from us: ${o.note}` : "", o.total !== undefined ? `Order total: ₹${(o.total / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : ""].filter(Boolean).join("\n\n");
  try {
    await sendEmail({ to: o.to, subject: c.subject(o.orderNumber), ...simpleEmail(c.title, body, { label: "View your order", url }) });
  } catch (err) {
    console.error(`[email] ${kind} for ${o.orderNumber} failed:`, (err as Error).message);
  }
}

