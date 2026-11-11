/** Admin dashboard figures. Money figures need reports.view or payments.view; counts need dashboard.view. */
import { customerDesigns, db, inventory, orderItems, orders, productVariants } from "@ecom/db";
import { can, canAny, requirePermission } from "@ecom/rbac";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { ServiceContext } from "./context";

const PAID = ["captured", "partially_refunded"] as const;

export interface DashboardData {
  today: { orders: number; revenue: number | null };
  queue: { toFulfil: number; designReview: number; awaitingPayment: number; lowStock: number };
  revenue30: { total: number; orders: number; average: number; series: { day: string; revenue: number; orders: number }[] } | null;
  byStatus: { status: string; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[] | null;
  recent: { id: string; orderNumber: string; status: string; total: number; placedAt: Date; customer: string }[];
}

export async function getDashboard(ctx: ServiceContext): Promise<DashboardData> {
  requirePermission(ctx.actor, "dashboard.view");
  const money = canAny(ctx.actor, ["reports.view", "payments.view"]);
  const seeOrders = canAny(ctx.actor, ["orders.view", "orders.view_assigned"]);
  const scope = can(ctx.actor, "orders.view") ? undefined : eq(orders.assignedStaffId, ctx.actor.userId);

  // "Today" and the 30-day window use India time.
  const startToday = sql`date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`;
  const since30 = new Date(Date.now() - 29 * 86_400_000);

  const [[today], [queue], [low], [designs], byStatus, recent] = await Promise.all([
    db
      .select({ orders: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(total_amount) filter (where payment_status in ('captured','partially_refunded')), 0)::int` })
      .from(orders)
      .where(and(sql`${orders.placedAt} >= ${startToday}`, sql`${orders.status} <> 'payment_pending'`, scope)),
    db
      .select({
        toFulfil: sql<number>`count(*) filter (where ${orders.status} in ('confirmed','design_approved','production','quality_check','packed','ready_for_dispatch'))::int`,
        awaitingPayment: sql<number>`count(*) filter (where ${orders.status} = 'payment_pending')::int`,
      })
      .from(orders)
      .where(scope),
    db.select({ n: sql<number>`count(*)::int` }).from(inventory).innerJoin(productVariants, eq(productVariants.id, inventory.variantId)).where(and(isNull(productVariants.deletedAt), sql`${inventory.onHand} - ${inventory.reserved} <= ${inventory.minStock}`)),
    db.select({ n: sql<number>`count(*)::int` }).from(customerDesigns).where(and(isNull(customerDesigns.deletedAt), inArray(customerDesigns.status, ["submitted", "in_review"]))),
    seeOrders
      ? db.select({ status: orders.status, count: sql<number>`count(*)::int` }).from(orders).where(scope).groupBy(orders.status)
      : Promise.resolve([]),
    seeOrders
      ? db
          .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, total: orders.totalAmount, placedAt: orders.placedAt, customer: sql<string>`${orders.shippingAddress}->>'fullName'` })
          .from(orders)
          .where(scope)
          .orderBy(desc(orders.placedAt))
          .limit(8)
      : Promise.resolve([]),
  ]);

  let revenue30: DashboardData["revenue30"] = null;
  let topProducts: DashboardData["topProducts"] = null;
  if (money) {
    const rows = (await db.execute(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
             coalesce(sum(o.total_amount), 0)::int as revenue,
             count(o.id)::int as orders
        from generate_series((now() at time zone 'Asia/Kolkata')::date - 29, (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d
        left join ${orders} o on (o.placed_at at time zone 'Asia/Kolkata')::date = d::date and o.payment_status in ('captured','partially_refunded')
       group by d order by d`)) as unknown as { rows: { day: string; revenue: number; orders: number }[] };
    const series = rows.rows.map((r) => ({ day: r.day, revenue: Number(r.revenue), orders: Number(r.orders) }));
    const total = series.reduce((a, s) => a + s.revenue, 0);
    const n = series.reduce((a, s) => a + s.orders, 0);
    revenue30 = { total, orders: n, average: n ? Math.round(total / n) : 0, series };
    topProducts = await db
      .select({ name: orderItems.productName, quantity: sql<number>`sum(${orderItems.quantity})::int`, revenue: sql<number>`sum(${orderItems.lineTotal})::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(gte(orders.placedAt, since30), inArray(orders.paymentStatus, [...PAID])))
      .groupBy(orderItems.productName)
      .orderBy(desc(sql`sum(${orderItems.lineTotal})`))
      .limit(5);
  }

  return {
    today: { orders: today?.orders ?? 0, revenue: money ? (today?.revenue ?? 0) : null },
    queue: { toFulfil: queue?.toFulfil ?? 0, designReview: designs?.n ?? 0, awaitingPayment: queue?.awaitingPayment ?? 0, lowStock: low?.n ?? 0 },
    revenue30,
    byStatus,
    topProducts,
    recent,
  };
}
