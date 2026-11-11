/** Customer management for staff (customers.view / customers.update). Staff accounts are never listed here. */
import { addresses, customerDesigns, db, orders, userRoles, users } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { customerListQuery, customerStatusSchema, type Paginated } from "@ecom/validation";
import { and, count, desc, eq, ilike, isNull, notExists, or, sql, type SQL } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { NotFoundError } from "./errors";

/** Built per call: touching `db` at import time breaks `next build` (no database during builds). */
const notStaff = () => notExists(db.select({ one: sql`1` }).from(userRoles).where(eq(userRoles.userId, users.id)));

export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "active" | "suspended";
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  createdAt: Date;
}

const spent = sql<number>`(select coalesce(sum(o.total_amount), 0)::int from ${orders} o where o.customer_id = "users"."id" and o.payment_status in ('captured','partially_refunded'))`;
const orderCount = sql<number>`(select count(*)::int from ${orders} o where o.customer_id = "users"."id")`;
const lastOrder = sql<Date | null>`(select max(o.placed_at) from ${orders} o where o.customer_id = "users"."id")`;

export async function listCustomers(ctx: ServiceContext, raw: unknown): Promise<Paginated<CustomerListItem>> {
  requirePermission(ctx.actor, "customers.view");
  const q = customerListQuery.parse(raw);
  const f: (SQL | undefined)[] = [isNull(users.deletedAt), eq(users.isStaff, false), notStaff()];
  if (q.status) f.push(eq(users.status, q.status));
  if (q.q) {
    const t = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    f.push(or(ilike(users.name, t), ilike(users.email, t), ilike(users.phone, t)));
  }
  const where = and(...f);
  const [rows, [t]] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status, orderCount, totalSpent: spent, lastOrderAt: lastOrder, createdAt: users.createdAt })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(users).where(where),
  ]);
  const total = t?.n ?? 0;
  return { items: rows as CustomerListItem[], page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function getCustomerAdmin(ctx: ServiceContext, id: string) {
  requirePermission(ctx.actor, "customers.view");
  const [u] = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, status: users.status, emailVerified: users.emailVerified, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt, clerkUserId: users.clerkUserId, orderCount, totalSpent: spent })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt), eq(users.isStaff, false), notStaff()));
  if (!u) throw new NotFoundError("Customer not found.");
  const [addrs, recent, [designs]] = await Promise.all([
    db.select().from(addresses).where(and(eq(addresses.userId, id), isNull(addresses.deletedAt))).orderBy(desc(addresses.isDefault)),
    db
      .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, paymentStatus: orders.paymentStatus, total: orders.totalAmount, placedAt: orders.placedAt })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.placedAt))
      .limit(50),
    db.select({ n: count() }).from(customerDesigns).where(and(eq(customerDesigns.customerId, id), isNull(customerDesigns.deletedAt))),
  ]);
  return { ...u, addresses: addrs, orders: recent, designCount: designs?.n ?? 0 };
}

/** Suspend or reactivate. A suspended customer is refused on every request (see lib/customer.ts). */
export async function setCustomerStatus(ctx: ServiceContext, id: string, raw: unknown) {
  requirePermission(ctx.actor, "customers.update");
  const { active, reason } = customerStatusSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt), eq(users.isStaff, false))).for("update");
    if (!u) throw new NotFoundError("Customer not found.");
    const next = active ? "active" : "suspended";
    if (u.status !== next) {
      await tx.update(users).set({ status: next, updatedAt: new Date() }).where(eq(users.id, id));
      await writeAudit(tx, ctx, { action: active ? "customer.activate" : "customer.suspend", entityType: "user", entityId: id, before: { status: u.status }, after: { status: next, reason: reason ?? null } });
    }
    return { id, status: next, clerkUserId: u.clerkUserId };
  });
}
