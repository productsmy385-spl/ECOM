import { PageHeader } from "@/components/layout/page-header";
import { OrderStatusBadge } from "@/components/order-status";
import { Card } from "@/components/ui/card";
import { getDashboardMetrics, type MetricKey } from "@/lib/queries/dashboard";
import { requireStaff } from "@/lib/session";
import { formatNumberIN, formatPaise } from "@ecom/ui/format";
import {
  AlertTriangle,
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
import { getDashboard } from "@ecom/services";
import type { Metadata } from "next";
import Link from "next/link";
import { RevenueChart } from "./revenue-chart";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const META: Record<MetricKey, { label: string; icon: LucideIcon; tone: string }> = {
  revenue: { label: "Net revenue", icon: IndianRupee, tone: "bg-primary/10 text-primary" },
  orders: { label: "Total orders", icon: ShoppingBag, tone: "bg-primary/10 text-primary" },
  pendingOrders: { label: "Orders in progress", icon: Clock, tone: "bg-warning/10 text-warning" },
  completedOrders: { label: "Delivered orders", icon: CheckCircle2, tone: "bg-success/10 text-success" },
  customers: { label: "Customers", icon: Users, tone: "bg-info/10 text-info" },
  activeProducts: { label: "Published products", icon: Package, tone: "bg-info/10 text-info" },
  lowStock: { label: "Low-stock variants", icon: AlertTriangle, tone: "bg-warning/10 text-warning" },
  pendingDesigns: { label: "Designs awaiting approval", icon: Palette, tone: "bg-primary/10 text-primary" },
  pendingDeliveries: { label: "Open deliveries", icon: Truck, tone: "bg-info/10 text-info" },
  failedPayments: { label: "Failed payments", icon: CreditCard, tone: "bg-destructive/10 text-destructive" },
};

export default async function DashboardPage() {
  const { actor, user } = await requireStaff("dashboard.view");
  const [metrics, board] = await Promise.all([getDashboardMetrics(actor), getDashboard({ actor })]);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Live figures from the store database · all time"
      />

      <section aria-label="Key metrics" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => {
          const { label, icon: Icon, tone } = META[m.key];
          return (
            <Card key={m.key} className="animate-fade-in-up p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight">
                    {m.kind === "money" ? formatPaise(m.value, { whole: true }) : formatNumberIN(m.value)}
                  </p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </Card>
          );
        })}
      </section>

      {board.revenue30 && (
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Paid revenue · last 30 days</h2>
              <p className="text-xs text-muted-foreground">India time, GST included</p>
            </div>
            <p className="text-sm">
              <span className="font-display text-xl font-semibold tabular-nums">{formatPaise(board.revenue30.total, { whole: true })}</span>
              <span className="text-muted-foreground"> · {board.revenue30.orders} orders · avg {formatPaise(board.revenue30.average, { whole: true })}</span>
            </p>
          </div>
          <div className="mt-4">
            <RevenueChart series={board.revenue30.series} />
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {[
              { label: "Orders to fulfil", value: board.queue.toFulfil, href: "/orders" },
              { label: "Designs to review", value: board.queue.designReview, href: "/designs" },
              { label: "Awaiting online payment", value: board.queue.awaitingPayment, href: "/orders?status=payment_pending" },
              { label: "Items low on stock", value: board.queue.lowStock, href: "/inventory" },
            ].map((r) => (
              <li key={r.label}>
                <Link href={r.href} className="flex items-center justify-between py-2.5 hover:text-primary">
                  {r.label}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${r.value > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{r.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {board.topProducts && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Top products · 30 days</h2>
            <ol className="mt-3 space-y-2.5 text-sm">
              {board.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {formatPaise(p.revenue, { whole: true })}
                    <span className="block text-xs text-muted-foreground">{p.quantity} sold</span>
                  </span>
                </li>
              ))}
              {board.topProducts.length === 0 && <li className="text-muted-foreground">No paid orders yet.</li>}
            </ol>
          </Card>
        )}

        {board.recent.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Latest orders</h2>
            <ul className="mt-3 space-y-2.5 text-sm">
              {board.recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 hover:text-primary">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs font-semibold">{o.orderNumber}</span>
                      <span className="block truncate text-xs text-muted-foreground">{o.customer}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <OrderStatusBadge status={o.status} />
                      <span className="tabular-nums">{formatPaise(o.total, { whole: true })}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {metrics.every((m) => m.value === 0) && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">The store is ready for its first products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Figures fill in as products are published and orders arrive.
          </p>
        </Card>
      )}
    </div>
  );
}
