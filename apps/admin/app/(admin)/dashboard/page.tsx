import { PageHeader } from "@/components/layout/page-header";
import { OrderStatusBadge } from "@/components/order-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradientCard, type GradientVariant, StatCard } from "@/components/ui/gradient-card";
import { getDashboardMetrics, type Metric, type MetricKey } from "@/lib/queries/dashboard";
import { requireStaff } from "@/lib/session";
import { getDashboard } from "@ecom/services";
import { formatNumberIN, formatPaise } from "@ecom/ui/format";
import { ORDER_STATUS_LABEL, type OrderStatusValue } from "@ecom/validation";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  IndianRupee,
  Package,
  Palette,
  ShoppingBag,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrdersChart, RevenueChart } from "./revenue-chart";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const META: Record<MetricKey, { label: string; icon: LucideIcon; tone: string; gradient: GradientVariant; href: string }> = {
  revenue: { label: "Net revenue", icon: IndianRupee, tone: "bg-primary/10 text-primary", gradient: "primary", href: "/payments" },
  orders: { label: "Total orders", icon: ShoppingBag, tone: "bg-info/10 text-info", gradient: "info", href: "/orders" },
  pendingOrders: { label: "Orders in progress", icon: Clock, tone: "bg-warning/10 text-warning", gradient: "warning", href: "/orders" },
  completedOrders: { label: "Delivered orders", icon: CheckCircle2, tone: "bg-success/10 text-success", gradient: "success", href: "/orders?status=delivered" },
  customers: { label: "Customers", icon: Users, tone: "bg-info/10 text-info", gradient: "info", href: "/customers" },
  activeProducts: { label: "Published products", icon: Package, tone: "bg-primary/10 text-primary", gradient: "rose", href: "/products" },
  lowStock: { label: "Low-stock variants", icon: AlertTriangle, tone: "bg-warning/10 text-warning", gradient: "warning", href: "/inventory" },
  pendingDesigns: { label: "Designs to approve", icon: Palette, tone: "bg-primary/10 text-primary", gradient: "rose", href: "/designs" },
  pendingDeliveries: { label: "Open deliveries", icon: Truck, tone: "bg-info/10 text-info", gradient: "info", href: "/deliveries" },
  failedPayments: { label: "Failed payments", icon: CreditCard, tone: "bg-destructive/10 text-destructive", gradient: "dark", href: "/payments" },
};

/** The four headline cards, in DropX order; whichever the role can see come first. */
const HEADLINE: MetricKey[] = ["revenue", "orders", "pendingOrders", "completedOrders", "customers", "activeProducts"];

const fmt = (m: Metric) => (m.kind === "money" ? formatPaise(m.value, { whole: true }) : formatNumberIN(m.value));

const STATUS_BAR: Partial<Record<OrderStatusValue, string>> = {
  delivered: "bg-success",
  cancelled: "bg-destructive",
  payment_pending: "bg-warning",
  shipped: "bg-info",
  out_for_delivery: "bg-info",
};

export default async function DashboardPage() {
  const { actor, user } = await requireStaff("dashboard.view");
  const [metrics, board] = await Promise.all([getDashboardMetrics(actor), getDashboard({ actor })]);
  const firstName = user.name.split(" ")[0];

  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const headline = HEADLINE.map((k) => byKey.get(k)).filter((m): m is Metric => !!m).slice(0, 4);
  const rest = metrics.filter((m) => !headline.includes(m));
  const statusTotal = board.byStatus.reduce((a, s) => a + s.count, 0);
  const statuses = [...board.byStatus].sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Welcome back, ${firstName}. Live store figures; revenue is money actually collected.`} />

      {headline.length > 0 && (
        <section aria-label="Key metrics" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {headline.map((m) => {
            const { label, icon: Icon, gradient, href } = META[m.key];
            return (
              <Link key={m.key} href={href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <GradientCard
                  title={label}
                  value={fmt(m)}
                  variant={gradient}
                  icon={<Icon />}
                  hint={
                    m.key === "revenue" && board.revenue30 ? (
                      <>
                        <span className="font-semibold text-white">{formatPaise(board.revenue30.total, { whole: true })}</span> in the last 30 days
                      </>
                    ) : m.key === "orders" ? (
                      <>
                        <span className="font-semibold text-white">{board.today.orders}</span> today
                      </>
                    ) : m.key === "pendingOrders" ? (
                      <>
                        <span className="font-semibold text-white">{board.queue.toFulfil}</span> to fulfil now
                      </>
                    ) : (
                      "All time"
                    )
                  }
                  className="h-full transition-transform duration-200 hover:-translate-y-0.5"
                />
              </Link>
            );
          })}
        </section>
      )}

      {rest.length > 0 && (
        <section aria-label="More metrics" className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {rest.map((m) => {
            const { label, icon: Icon, tone, href } = META[m.key];
            return (
              <Link key={m.key} href={href} className="rounded-xl">
                <StatCard title={label} value={fmt(m)} icon={<Icon />} tone={tone} className="h-full transition-colors hover:border-primary/30" />
              </Link>
            );
          })}
        </section>
      )}

      {board.revenue30 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Revenue</CardTitle>
                <p className="mt-1.5 text-xs text-muted-foreground">Paid orders, last 30 days · India time · GST included</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Revenue
                </span>
                <span className="text-foreground">
                  <span className="font-display text-base font-semibold tabular-nums">{formatPaise(board.revenue30.total, { whole: true })}</span>
                  <span className="text-muted-foreground"> · avg order {formatPaise(board.revenue30.average, { whole: true })}</span>
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RevenueChart series={board.revenue30.series} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {board.revenue30 && (
          <Card className="xl:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Orders</CardTitle>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-info" /> Paid orders · {board.revenue30.orders} in 30 days
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <OrdersChart series={board.revenue30.series} />
            </CardContent>
          </Card>
        )}

        <Card className={board.revenue30 ? "" : "xl:col-span-3"}>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[
                { label: "Orders to fulfil", value: board.queue.toFulfil, href: "/orders", icon: ShoppingBag, tone: "bg-primary/10 text-primary" },
                { label: "Designs to review", value: board.queue.designReview, href: "/designs", icon: Palette, tone: "bg-info/10 text-info" },
                { label: "Awaiting online payment", value: board.queue.awaitingPayment, href: "/orders?status=payment_pending", icon: CreditCard, tone: "bg-warning/10 text-warning" },
                { label: "Items low on stock", value: board.queue.lowStock, href: "/inventory", icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
              ].map((r) => (
                <li key={r.label}>
                  <Link href={r.href} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/40">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${r.tone}`}>
                      <r.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium">{r.label}</span>
                    <span className="font-display text-lg font-semibold tabular-nums">{r.value}</span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {board.topProducts && (
          <Card>
            <CardHeader>
              <CardTitle>Top selling products · 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border pb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Product</span>
                  <span className="text-right">Sold</span>
                  <span className="w-24 text-right">Revenue</span>
                </div>
                {board.topProducts.map((p, i) => (
                  <div key={p.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-2xs font-bold text-muted-foreground">{i + 1}</span>
                      <span className="truncate font-medium">{p.name}</span>
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">{p.quantity}</span>
                    <span className="w-24 text-right font-semibold tabular-nums">{formatPaise(p.revenue, { whole: true })}</span>
                  </div>
                ))}
                {board.topProducts.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No paid orders in the last 30 days.</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {statuses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Order status distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {statuses.map((s) => (
                  <li key={s.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <OrderStatusBadge status={s.status} />
                      <span className="font-semibold tabular-nums">
                        {s.count} <span className="font-normal text-muted-foreground">{s.count === 1 ? "order" : "orders"}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
                      <div
                        className={`h-full rounded-full ${STATUS_BAR[s.status as OrderStatusValue] ?? "bg-gradient-to-r from-primary to-highlight"}`}
                        style={{ width: `${statusTotal ? Math.max(3, (s.count / statusTotal) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="sr-only">{ORDER_STATUS_LABEL[s.status as OrderStatusValue] ?? s.status}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {board.recent.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Recent orders</CardTitle>
              <Link href="/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/50 text-muted-foreground">
                  <th className="px-5 py-3 text-left">Order</th>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Placed</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {board.recent.map((o) => (
                  <tr key={o.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link href={`/orders/${o.id}`} className="font-mono text-xs font-semibold hover:text-primary">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-bold text-primary">
                          {(o.customer ?? "?")
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </span>
                        <span className="font-medium">{o.customer}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(o.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-5 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatPaise(o.total, { whole: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {metrics.every((m) => m.value === 0) && (
        <Card className="p-5">
          <CardTitle>The store is ready for its first products</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">Figures fill in as products are published and orders arrive.</p>
        </Card>
      )}
    </div>
  );
}
