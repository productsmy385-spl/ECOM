import "server-only";
import {
  customerDesigns,
  db,
  deliveries,
  inventory,
  orders,
  payments,
  products,
  users,
} from "@ecom/db";
import { type Actor, can, canAny, type Permission } from "@ecom/rbac";
import { and, count, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

const OPEN_ORDER = [
  "confirmed",
  "design_review",
  "design_approved",
  "production",
  "quality_check",
  "packed",
  "ready_for_dispatch",
] as const;
const PLACED_EXCLUDED = ["pending", "payment_pending"] as const;
const PENDING_DESIGN = ["submitted", "in_review", "awaiting_customer"] as const;
const OPEN_DELIVERY = ["unassigned", "assigned", "picked_up", "in_transit", "out_for_delivery"] as const;

export type MetricKey =
  | "revenue"
  | "orders"
  | "pendingOrders"
  | "completedOrders"
  | "customers"
  | "activeProducts"
  | "lowStock"
  | "pendingDesigns"
  | "pendingDeliveries"
  | "failedPayments";

export interface Metric {
  key: MetricKey;
  value: number;
  /** "money" values are paise. */
  kind: "money" | "count";
}

/** Which permission(s) reveal each metric — finance numbers stay with finance roles. */
const VISIBILITY: Record<MetricKey, Permission[]> = {
  revenue: ["payments.view", "reports.view"],
  orders: ["orders.view"],
  pendingOrders: ["orders.view"],
  completedOrders: ["orders.view"],
  customers: ["customers.view"],
  activeProducts: ["products.view"],
  lowStock: ["inventory.view"],
  pendingDesigns: ["designs.view"],
  pendingDeliveries: ["deliveries.view"],
  failedPayments: ["payments.view"],
};

const QUERIES: Record<MetricKey, () => Promise<number>> = {
  // Net money actually captured (minus refunds) — never order totals that may be unpaid.
  revenue: async () => {
    const [r] = await db
      .select({ v: sql<string>`coalesce(sum(${payments.amount} - ${payments.refundedAmount}), 0)` })
      .from(payments)
      .where(inArray(payments.status, ["captured", "partially_refunded", "refunded"]));
    return Number(r?.v ?? 0);
  },
  orders: async () => {
    const [r] = await db
      .select({ v: count() })
      .from(orders)
      .where(notInArray(orders.status, [...PLACED_EXCLUDED]));
    return r?.v ?? 0;
  },
  pendingOrders: async () => {
    const [r] = await db.select({ v: count() }).from(orders).where(inArray(orders.status, [...OPEN_ORDER]));
    return r?.v ?? 0;
  },
  completedOrders: async () => {
    const [r] = await db.select({ v: count() }).from(orders).where(eq(orders.status, "delivered"));
    return r?.v ?? 0;
  },
  customers: async () => {
    const [r] = await db
      .select({ v: count() })
      .from(users)
      .where(and(eq(users.isStaff, false), isNull(users.deletedAt)));
    return r?.v ?? 0;
  },
  activeProducts: async () => {
    const [r] = await db
      .select({ v: count() })
      .from(products)
      .where(and(eq(products.status, "published"), isNull(products.deletedAt)));
    return r?.v ?? 0;
  },
  lowStock: async () => {
    const [r] = await db
      .select({ v: count() })
      .from(inventory)
      // Same rule as the Inventory page: live variants of live products only.
      .where(sql`${inventory.onHand} - ${inventory.reserved} <= ${inventory.minStock}
                 and exists (select 1 from product_variants v join products p on p.id = v.product_id
                              where v.id = "inventory"."variant_id" and v.deleted_at is null and p.deleted_at is null)`);
    return r?.v ?? 0;
  },
  pendingDesigns: async () => {
    const [r] = await db
      .select({ v: count() })
      .from(customerDesigns)
      .where(and(inArray(customerDesigns.status, [...PENDING_DESIGN]), isNull(customerDesigns.deletedAt)));
    return r?.v ?? 0;
  },
  pendingDeliveries: async () => {
    const [r] = await db.select({ v: count() }).from(deliveries).where(inArray(deliveries.status, [...OPEN_DELIVERY]));
    return r?.v ?? 0;
  },
  failedPayments: async () => {
    const [r] = await db.select({ v: count() }).from(payments).where(eq(payments.status, "failed"));
    return r?.v ?? 0;
  },
};

/**
 * Computes only the metrics the actor may see. Values come straight from
 * PostgreSQL — no cached or hard-coded numbers. Date-range filters arrive with
 * the Phase 7 dashboard; these are all-time figures and are labelled as such.
 */
export async function getDashboardMetrics(actor: Actor): Promise<Metric[]> {
  if (!can(actor, "dashboard.view")) return [];
  const keys = (Object.keys(VISIBILITY) as MetricKey[]).filter((k) => canAny(actor, VISIBILITY[k]));
  const values = await Promise.all(keys.map((k) => QUERIES[k]()));
  return keys.map((key, i) => ({ key, value: values[i]!, kind: key === "revenue" ? "money" : "count" }));
}
