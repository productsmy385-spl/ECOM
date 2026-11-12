/**
 * Headline figures for the DropX-style summary cards on admin list pages.
 * Each is gated by the same permission as the page it sits on.
 */
import { db } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { sql } from "drizzle-orm";
import type { ServiceContext } from "./context";

async function one<T>(q: ReturnType<typeof sql>): Promise<T> {
  const r = (await db.execute(q)) as unknown as { rows: T[] };
  return r.rows[0]!;
}

export interface PaymentSummary {
  collected: number;
  online: number;
  cod: number;
  refunded: number;
  failed: number;
}

/** Payments page: money collected (net of refunds), split by method, plus refunds and failures. */
export async function paymentSummary(ctx: ServiceContext): Promise<PaymentSummary> {
  requirePermission(ctx.actor, "payments.view");
  const r = await one<Record<keyof PaymentSummary, string>>(sql`
    select coalesce(sum(amount - refunded_amount) filter (where status in ('captured','partially_refunded','refunded')), 0) as collected,
           coalesce(sum(amount - refunded_amount) filter (where provider = 'razorpay' and status in ('captured','partially_refunded','refunded')), 0) as online,
           coalesce(sum(amount - refunded_amount) filter (where provider = 'cod' and status in ('captured','partially_refunded','refunded')), 0) as cod,
           coalesce(sum(refunded_amount), 0) as refunded,
           count(*) filter (where status = 'failed') as failed
      from payments`);
  return { collected: Number(r.collected), online: Number(r.online), cod: Number(r.cod), refunded: Number(r.refunded), failed: Number(r.failed) };
}

export interface CustomerSummary {
  total: number;
  newThisMonth: number;
  buyers: number;
  repeat: number;
}

/** Customers page: accounts, sign-ups this month (IST), customers who ordered, and repeat buyers. */
export async function customerSummary(ctx: ServiceContext): Promise<CustomerSummary> {
  requirePermission(ctx.actor, "customers.view");
  const r = await one<Record<keyof CustomerSummary, string>>(sql`
    with buyers as (
      select customer_id, count(*) as n from orders
       where customer_id is not null and status not in ('pending','payment_pending','cancelled')
       group by customer_id)
    select (select count(*) from users where not is_staff and deleted_at is null) as total,
           (select count(*) from users where not is_staff and deleted_at is null
              and created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as "newThisMonth",
           (select count(*) from buyers) as buyers,
           (select count(*) from buyers where n > 1) as repeat`);
  return { total: Number(r.total), newThisMonth: Number(r.newThisMonth), buyers: Number(r.buyers), repeat: Number(r.repeat) };
}

export interface InventorySummary {
  variants: number;
  units: number;
  low: number;
  out: number;
  /** Stock on hand at selling price (paise). */
  retailValue: number;
}

/** Inventory page: variants tracked, units on hand, low and out of stock, and retail value of stock. */
export async function inventorySummary(ctx: ServiceContext): Promise<InventorySummary> {
  requirePermission(ctx.actor, "inventory.view");
  const r = await one<Record<keyof InventorySummary, string>>(sql`
    select count(*) as variants,
           coalesce(sum(i.on_hand), 0) as units,
           count(*) filter (where i.on_hand - i.reserved > 0 and i.on_hand - i.reserved <= i.min_stock) as low,
           count(*) filter (where i.on_hand - i.reserved <= 0) as out,
           coalesce(sum(i.on_hand::bigint * v.price), 0) as "retailValue"
      from inventory i
      join product_variants v on v.id = i.variant_id
      join products p on p.id = v.product_id
     where v.deleted_at is null and p.deleted_at is null`);
  return { variants: Number(r.variants), units: Number(r.units), low: Number(r.low), out: Number(r.out), retailValue: Number(r.retailValue) };
}
