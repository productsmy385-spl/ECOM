/**
 * Phase 9 — reports. Each report is one read-only SQL query over a date range
 * in India time (IST), returned as columns + rows so the page, CSV, XLSX and
 * the printable (PDF) view all share one shape.
 *
 * Access: every report needs `reports.view`, plus the module permission that
 * owns its data (e.g. an Inventory Manager sees the inventory report but not
 * sales). Exports additionally need `reports.export`.
 * Money is integer paise throughout; exports convert to rupees.
 */
import { db } from "@ecom/db";
import { can, canAny, requirePermission, type Actor, type Permission } from "@ecom/rbac";
import { sql, type SQL } from "drizzle-orm";
import type { ServiceContext } from "./context";
import { AuthorizationError, ValidationError } from "./errors";

export type ReportColumnKind = "text" | "int" | "money" | "date" | "datetime" | "hours";
export interface ReportColumn {
  key: string;
  label: string;
  kind: ReportColumnKind;
}
export type ReportValue = string | number | null;
export type ReportRow = Record<string, ReportValue>;

export interface ReportResult {
  key: ReportKey;
  title: string;
  description: string;
  range: { from: string; to: string } | null;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Column sums for int/money columns (null when the report has no totals row). */
  totals: ReportRow | null;
  truncated: boolean;
}

export const REPORT_KEYS = ["sales", "revenue", "products", "categories", "customers", "inventory", "payments", "refunds", "deliveries", "staff"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

const MAX_ROWS = 5000;
const MAX_DAYS = 366;

/** Orders that count as sales: placed and not abandoned/unpaid/cancelled. */
const SOLD = sql.raw(`o.status not in ('pending','payment_pending','cancelled')`);

interface ReportDef {
  title: string;
  description: string;
  /** Besides reports.view, the caller needs ANY of these. */
  anyOf: Permission[];
  dated: boolean;
  totals: boolean;
  columns: ReportColumn[];
  query: (from: SQL, to: SQL) => SQL;
}

const c = (key: string, label: string, kind: ReportColumnKind = "text"): ReportColumn => ({ key, label, kind });

const DEFS: Record<ReportKey, ReportDef> = {
  sales: {
    title: "Sales",
    description: "Orders placed each day (unpaid online orders and cancellations excluded). Totals include GST.",
    anyOf: ["orders.view", "payments.view"],
    dated: true,
    totals: true,
    columns: [c("day", "Day", "date"), c("orders", "Orders", "int"), c("units", "Units", "int"), c("subtotal", "Items", "money"), c("discount", "Discounts", "money"), c("shipping", "Shipping", "money"), c("tax", "GST incl.", "money"), c("total", "Order total", "money")],
    query: (from, to) => sql`
      with d as (select generate_series(${from}::date, ${to}::date, interval '1 day')::date as day),
           o as (select o.*, (o.placed_at at time zone 'Asia/Kolkata')::date as day from orders o
                  where ${SOLD} and o.placed_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
                    and o.placed_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'),
           u as (select o.day, sum(i.quantity)::int as units from o join order_items i on i.order_id = o.id group by o.day)
      select to_char(d.day, 'YYYY-MM-DD') as day,
             count(o.id)::int as orders, coalesce(max(u.units), 0)::int as units,
             coalesce(sum(o.subtotal), 0)::bigint as subtotal, coalesce(sum(o.discount_amount), 0)::bigint as discount,
             coalesce(sum(o.shipping_amount), 0)::bigint as shipping, coalesce(sum(o.tax_amount), 0)::bigint as tax,
             coalesce(sum(o.total_amount), 0)::bigint as total
        from d left join o on o.day = d.day left join u on u.day = d.day
       group by d.day order by d.day`,
  },
  revenue: {
    title: "Revenue",
    description: "Money actually collected each day: captured payments (COD counts when delivered) less refunds processed that day.",
    anyOf: ["payments.view"],
    dated: true,
    totals: true,
    columns: [c("day", "Day", "date"), c("payments", "Payments", "int"), c("online", "Online", "money"), c("cod", "Cash on delivery", "money"), c("gross", "Collected", "money"), c("refunds", "Refunded", "money"), c("net", "Net revenue", "money")],
    query: (from, to) => sql`
      with d as (select generate_series(${from}::date, ${to}::date, interval '1 day')::date as day),
           p as (select (captured_at at time zone 'Asia/Kolkata')::date as day, provider, amount from payments
                  where captured_at is not null and captured_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
                    and captured_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'),
           r as (select (processed_at at time zone 'Asia/Kolkata')::date as day, sum(amount)::bigint as amount from refunds
                  where status = 'processed' and processed_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
                    and processed_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata' group by 1)
      select to_char(d.day, 'YYYY-MM-DD') as day, count(p.amount)::int as payments,
             coalesce(sum(p.amount) filter (where p.provider = 'razorpay'), 0)::bigint as online,
             coalesce(sum(p.amount) filter (where p.provider = 'cod'), 0)::bigint as cod,
             coalesce(sum(p.amount), 0)::bigint as gross,
             coalesce(max(r.amount), 0)::bigint as refunds,
             (coalesce(sum(p.amount), 0) - coalesce(max(r.amount), 0))::bigint as net
        from d left join p on p.day = d.day left join r on r.day = d.day
       group by d.day order by d.day`,
  },
  products: {
    title: "Products",
    description: "Units and sales by product for orders placed in the range.",
    anyOf: ["orders.view", "payments.view"],
    dated: true,
    totals: true,
    columns: [c("product", "Product"), c("category", "Category"), c("orders", "Orders", "int"), c("units", "Units", "int"), c("tax", "GST incl.", "money"), c("revenue", "Sales", "money")],
    query: (from, to) => sql`
      select coalesce(p.name, max(i.product_name)) as product, coalesce(cat.name, '—') as category,
             count(distinct o.id)::int as orders, sum(i.quantity)::int as units,
             sum(i.tax_amount)::bigint as tax, sum(i.line_total)::bigint as revenue
        from order_items i join orders o on o.id = i.order_id
        left join products p on p.id = i.product_id left join categories cat on cat.id = p.category_id
       where ${SOLD} and o.placed_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
         and o.placed_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'
       group by i.product_id, p.name, cat.name order by revenue desc`,
  },
  categories: {
    title: "Categories",
    description: "Units and sales by category for orders placed in the range.",
    anyOf: ["orders.view", "payments.view"],
    dated: true,
    totals: true,
    columns: [c("category", "Category"), c("products", "Products sold", "int"), c("orders", "Orders", "int"), c("units", "Units", "int"), c("revenue", "Sales", "money")],
    query: (from, to) => sql`
      select coalesce(cat.name, 'Uncategorised') as category, count(distinct i.product_id)::int as products,
             count(distinct o.id)::int as orders, sum(i.quantity)::int as units, sum(i.line_total)::bigint as revenue
        from order_items i join orders o on o.id = i.order_id
        left join products p on p.id = i.product_id left join categories cat on cat.id = p.category_id
       where ${SOLD} and o.placed_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
         and o.placed_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'
       group by cat.name order by revenue desc`,
  },
  customers: {
    title: "Customers",
    description: "Who bought in the range: orders, spend and first/last order. Guests are listed by email.",
    anyOf: ["customers.view", "payments.view"],
    dated: true,
    totals: true,
    columns: [c("customer", "Customer"), c("email", "Email"), c("type", "Type"), c("orders", "Orders", "int"), c("spent", "Spent", "money"), c("average", "Avg. order", "money"), c("first", "First order", "date"), c("last", "Last order", "date")],
    query: (from, to) => sql`
      select coalesce(u.name, max(o.shipping_address->>'fullName')) as customer,
             coalesce(u.email, lower(o.guest_email)) as email,
             case when u.id is null then 'Guest' else 'Account' end as type,
             count(*)::int as orders, sum(o.total_amount)::bigint as spent,
             round(avg(o.total_amount))::bigint as average,
             to_char(min(o.placed_at at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') as first,
             to_char(max(o.placed_at at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') as last
        from orders o left join users u on u.id = o.customer_id
       where ${SOLD} and o.placed_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
         and o.placed_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'
       group by u.id, u.name, u.email, lower(o.guest_email) order by spent desc`,
  },
  inventory: {
    title: "Inventory",
    description: "Stock now, and the movements during the range (received, sold, returned, adjusted).",
    anyOf: ["inventory.view"],
    dated: true,
    totals: true,
    columns: [c("sku", "SKU"), c("product", "Product"), c("variant", "Variant"), c("onHand", "On hand", "int"), c("reserved", "Reserved", "int"), c("available", "Available", "int"), c("minStock", "Min.", "int"), c("received", "Received", "int"), c("sold", "Sold", "int"), c("returned", "Returned", "int"), c("adjusted", "Adjusted", "int"), c("state", "Status")],
    query: (from, to) => sql`
      with m as (select variant_id,
                        sum(on_hand_delta) filter (where type = 'purchase')::int as received,
                        (-sum(on_hand_delta) filter (where type = 'fulfillment'))::int as sold,
                        sum(on_hand_delta) filter (where type = 'return')::int as returned,
                        sum(on_hand_delta) filter (where type = 'adjustment')::int as adjusted
                   from inventory_movements
                  where created_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
                    and created_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'
                  group by variant_id)
      select v.sku, p.name as product, v.name as variant, inv.on_hand as "onHand", inv.reserved,
             (inv.on_hand - inv.reserved) as available, inv.min_stock as "minStock",
             coalesce(m.received, 0) as received, coalesce(m.sold, 0) as sold,
             coalesce(m.returned, 0) as returned, coalesce(m.adjusted, 0) as adjusted,
             case when inv.on_hand - inv.reserved <= 0 then 'Out of stock'
                  when inv.on_hand - inv.reserved <= inv.min_stock then 'Low' else 'OK' end as state
        from inventory inv join product_variants v on v.id = inv.variant_id join products p on p.id = v.product_id
        left join m on m.variant_id = inv.variant_id
       where v.deleted_at is null and p.deleted_at is null
       order by (inv.on_hand - inv.reserved - inv.min_stock), p.name, v.sku`,
  },
  payments: {
    title: "Payments",
    description: "Every payment attempt created in the range, with its outcome.",
    anyOf: ["payments.view"],
    dated: true,
    totals: true,
    columns: [c("createdAt", "Created", "datetime"), c("order", "Order"), c("provider", "Provider"), c("method", "Method"), c("status", "Status"), c("amount", "Amount", "money"), c("refunded", "Refunded", "money"), c("capturedAt", "Captured", "datetime"), c("reference", "Gateway reference")],
    query: (from, to) => sql`
      select to_char(p.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as "createdAt", o.order_number as order,
             case p.provider when 'cod' then 'Cash on delivery' else 'Razorpay' end as provider,
             coalesce(p.method, '') as method, p.status::text as status, p.amount::bigint as amount,
             p.refunded_amount::bigint as refunded,
             to_char(p.captured_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as "capturedAt",
             coalesce(p.razorpay_payment_id, p.razorpay_order_id, '') as reference
        from payments p join orders o on o.id = p.order_id
       where p.created_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
         and p.created_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'
       order by p.created_at desc`,
  },
  refunds: {
    title: "Refunds",
    description: "Refunds requested in the range and where each one stands.",
    anyOf: ["payments.view"],
    dated: true,
    totals: true,
    columns: [c("createdAt", "Requested", "datetime"), c("order", "Order"), c("amount", "Amount", "money"), c("status", "Status"), c("reason", "Reason"), c("requestedBy", "Requested by"), c("processedAt", "Processed", "datetime"), c("reference", "Gateway reference")],
    query: (from, to) => sql`
      select to_char(r.created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as "createdAt", o.order_number as order,
             r.amount::bigint as amount, r.status::text as status, coalesce(r.reason, '') as reason,
             coalesce(u.name, '') as "requestedBy",
             to_char(r.processed_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as "processedAt",
             coalesce(r.razorpay_refund_id, '') as reference
        from refunds r join orders o on o.id = r.order_id left join users u on u.id = r.requested_by
       where r.created_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
         and r.created_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'
       order by r.created_at desc`,
  },
  deliveries: {
    title: "Deliveries",
    description: "Deliveries created in the range, by delivery captain: outcomes, cash collected and time on the road.",
    anyOf: ["deliveries.view", "orders.view"],
    dated: true,
    totals: true,
    columns: [c("captain", "Captain"), c("deliveries", "Deliveries", "int"), c("delivered", "Delivered", "int"), c("failed", "Failed", "int"), c("open", "Open", "int"), c("attempts", "Attempts", "int"), c("cod", "Cash collected", "money"), c("avgHours", "Avg. pickup → delivered", "hours")],
    query: (from, to) => sql`
      select coalesce(u.name, 'Unassigned') as captain, count(*)::int as deliveries,
             count(*) filter (where d.status = 'delivered')::int as delivered,
             count(*) filter (where d.status = 'failed')::int as failed,
             count(*) filter (where d.status not in ('delivered','failed'))::int as open,
             coalesce(sum(d.attempts), 0)::int as attempts,
             coalesce(sum(p.amount) filter (where d.status = 'delivered'), 0)::bigint as cod,
             round((avg(extract(epoch from d.delivered_at - d.picked_up_at)) / 3600)::numeric, 1)::float as "avgHours"
        from deliveries d left join users u on u.id = d.captain_id
        left join payments p on p.order_id = d.order_id and p.provider = 'cod' and p.status = 'captured'
       where d.created_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
         and d.created_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata'
       group by u.id, u.name order by deliveries desc`,
  },
  staff: {
    title: "Staff",
    description: "Per staff member: orders assigned (placed in the range) and how they ended, order updates made, and designs worked on.",
    anyOf: ["staff.view", "orders.view"],
    dated: true,
    totals: true,
    columns: [c("name", "Staff member"), c("assigned", "Orders assigned", "int"), c("delivered", "Delivered", "int"), c("cancelled", "Cancelled", "int"), c("open", "Open", "int"), c("updates", "Order updates", "int"), c("designs", "Designs assigned", "int")],
    query: (from, to) => sql`
      with a as (select assigned_staff_id as id, count(*)::int as assigned,
                        count(*) filter (where status = 'delivered')::int as delivered,
                        count(*) filter (where status = 'cancelled')::int as cancelled,
                        count(*) filter (where status not in ('delivered','cancelled','returned','refunded'))::int as open
                   from orders where assigned_staff_id is not null
                    and placed_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
                    and placed_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata' group by 1),
           h as (select actor_id as id, count(*)::int as updates from order_status_history
                  where actor_id is not null and created_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
                    and created_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata' group by 1),
           g as (select assigned_designer_id as id, count(*)::int as designs from customer_designs
                  where assigned_designer_id is not null and deleted_at is null
                    and updated_at >= ${from}::date::timestamp at time zone 'Asia/Kolkata'
                    and updated_at < (${to}::date + 1)::timestamp at time zone 'Asia/Kolkata' group by 1)
      select u.name, coalesce(a.assigned, 0) as assigned, coalesce(a.delivered, 0) as delivered,
             coalesce(a.cancelled, 0) as cancelled, coalesce(a.open, 0) as open,
             coalesce(h.updates, 0) as updates, coalesce(g.designs, 0) as designs
        from users u left join a on a.id = u.id left join h on h.id = u.id left join g on g.id = u.id
       where u.is_staff and (a.id is not null or h.id is not null or g.id is not null)
       order by coalesce(a.assigned, 0) + coalesce(h.updates, 0) desc, u.name`,
  },
};

export interface ReportSummary {
  key: ReportKey;
  title: string;
  description: string;
}

function allowed(actor: Actor, key: ReportKey) {
  return can(actor, "reports.view") && canAny(actor, DEFS[key].anyOf);
}

/** Reports this person may open (for the menu). */
export function listReports(actor: Actor): ReportSummary[] {
  return REPORT_KEYS.filter((k) => allowed(actor, k)).map((key) => ({ key, title: DEFS[key].title, description: DEFS[key].description }));
}

export function isReportKey(v: string): v is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(v);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
function istToday(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}
function shift(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Validates ?from&to (YYYY-MM-DD, IST). Default: the last 30 days. */
export function resolveRange(input: { from?: string | null; to?: string | null }): { from: string; to: string } {
  const valid = (d?: string | null) => !!d && DAY.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);
  const to = valid(input.to) ? input.to! : istToday();
  const from = valid(input.from) ? input.from! : shift(to, -29);
  if (from > to) throw new ValidationError("The start date must be on or before the end date.");
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 > MAX_DAYS) throw new ValidationError(`Reports cover at most ${MAX_DAYS} days.`);
  return { from, to };
}

export async function runReport(ctx: ServiceContext, key: ReportKey, input: { from?: string | null; to?: string | null; export?: boolean }): Promise<ReportResult> {
  requirePermission(ctx.actor, "reports.view");
  if (input.export) requirePermission(ctx.actor, "reports.export");
  const def = DEFS[key];
  if (!canAny(ctx.actor, def.anyOf)) throw new AuthorizationError("You don't have access to this report.");
  const range = resolveRange(input);

  const res = (await db.execute(sql`${def.query(sql`${range.from}`, sql`${range.to}`)} limit ${MAX_ROWS + 1}`)) as unknown as { rows: Record<string, unknown>[] };
  const truncated = res.rows.length > MAX_ROWS;
  const numeric = new Set(def.columns.filter((col) => col.kind === "int" || col.kind === "money" || col.kind === "hours").map((col) => col.key));
  const rows: ReportRow[] = res.rows.slice(0, MAX_ROWS).map((r) => {
    const out: ReportRow = {};
    for (const col of def.columns) {
      const v = r[col.key];
      out[col.key] = v === null || v === undefined ? null : numeric.has(col.key) ? Number(v) : String(v);
    }
    return out;
  });

  let totals: ReportRow | null = null;
  if (def.totals && rows.length) {
    totals = {};
    for (const col of def.columns) {
      if (col.kind === "int" || col.kind === "money") totals[col.key] = rows.reduce((a, r) => a + (Number(r[col.key]) || 0), 0);
      else totals[col.key] = null;
    }
    totals[def.columns[0]!.key] = "Total";
  }
  return { key, title: def.title, description: def.description, range: def.dated ? range : null, columns: def.columns, rows, totals, truncated };
}
