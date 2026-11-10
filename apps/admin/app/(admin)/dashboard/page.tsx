import { PageHeader } from "@/components/layout/page-header";
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
import type { Metadata } from "next";

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
  const metrics = await getDashboardMetrics(actor);
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

      {metrics.every((m) => m.value === 0) && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">The store is ready for its first products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Figures will fill in as products are published and orders arrive. Catalog management and
            charts arrive in upcoming phases.
          </p>
        </Card>
      )}
    </div>
  );
}
