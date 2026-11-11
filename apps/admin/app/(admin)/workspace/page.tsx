import { PageHeader } from "@/components/layout/page-header";
import { OrderStatusBadge } from "@/components/order-status";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/session";
import { can, canAny } from "@ecom/rbac";
import { listDeliveries, listDesignsAdmin, listOrdersAdmin, listStock, myDeliveryCounts } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "My work" };
export const dynamic = "force-dynamic";

const DESIGN_LABEL: Record<string, string> = { submitted: "To review", in_review: "In review", awaiting_customer: "Waiting on customer", changes_requested: "Changes requested", approved: "Approved", rejected: "Rejected", draft: "Draft" };

function Section({ title, href, children, empty }: { title: string; href: string; children: React.ReactNode; empty: boolean }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={href} className="inline-flex items-center text-xs font-semibold text-link hover:underline">
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {empty ? <p className="px-5 py-6 text-sm text-muted-foreground">Nothing waiting for you.</p> : <ul className="divide-y divide-border">{children}</ul>}
    </Card>
  );
}

/** One page with each person's own queues, built from what their roles allow. */
export default async function WorkspacePage() {
  const { actor, user } = await requireStaff();
  const ctx = { actor };
  const [orders, designs, deliveries, review, low, counts] = await Promise.all([
    canAny(actor, ["orders.view", "orders.view_assigned"]) ? listOrdersAdmin(ctx, { mine: true, pageSize: 8 }) : null,
    canAny(actor, ["designs.view", "designs.view_assigned"]) ? listDesignsAdmin(ctx, { mine: "1", pageSize: 8 }) : null,
    can(actor, "deliveries.view_assigned") ? listDeliveries(ctx, { open: true, pageSize: 8 }) : null,
    can(actor, "designs.assign") ? listDesignsAdmin(ctx, { status: "submitted", pageSize: 6 }) : null,
    can(actor, "inventory.view") ? listStock(ctx, { low: true, pageSize: 6 }) : null,
    myDeliveryCounts(actor),
  ]);
  const activeOrders = orders?.items.filter((o) => !["delivered", "cancelled", "refunded", "returned"].includes(o.status)) ?? null;
  const activeDesigns = designs?.items.filter((d) => !["approved", "rejected"].includes(d.status)) ?? null;
  const nothing = !orders && !designs && !deliveries && !review && !low;

  return (
    <div className="space-y-6">
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} description="Everything waiting for you, in one place." />
      {nothing && <Card className="p-5 text-sm text-muted-foreground">Your role has no queues yet. Use the menu to get around.</Card>}
      <div className="grid gap-6 lg:grid-cols-2">
        {deliveries && (
          <Section title={`My deliveries${counts?.active ? ` · ${counts.active} active` : ""}`} href="/deliveries" empty={deliveries.items.length === 0}>
            {deliveries.items.map((d) => (
              <li key={d.id}>
                <Link href={`/deliveries/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                  <span className="min-w-0">
                    <span className="block font-mono text-xs font-semibold">{d.orderNumber}</span>
                    <span className="block truncate text-muted-foreground">{d.customerName} · {d.city}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Badge variant="secondary">{d.status.replace(/_/g, " ")}</Badge>
                    {d.codDue > 0 && <span className="mt-1 block text-xs font-semibold text-warning">Collect {formatPaise(d.codDue)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </Section>
        )}
        {activeOrders && (
          <Section title="Orders assigned to me" href="/orders" empty={activeOrders.length === 0}>
            {activeOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                  <span className="min-w-0"><span className="block font-mono text-xs font-semibold">{o.orderNumber}</span><span className="block truncate text-muted-foreground">{o.customerName}</span></span>
                  <OrderStatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </Section>
        )}
        {activeDesigns && (
          <Section title="Designs assigned to me" href="/designs" empty={activeDesigns.length === 0}>
            {activeDesigns.map((d) => (
              <li key={d.id}>
                <Link href={`/designs/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                  <span className="min-w-0"><span className="block truncate font-medium">{d.productName}</span><span className="block truncate text-xs text-muted-foreground">{d.customerName} · {d.name}</span></span>
                  <Badge variant="secondary">{DESIGN_LABEL[d.status] ?? d.status}</Badge>
                </Link>
              </li>
            ))}
          </Section>
        )}
        {review && (
          <Section title="New designs to assign" href="/designs" empty={review.items.length === 0}>
            {review.items.map((d) => (
              <li key={d.id}>
                <Link href={`/designs/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                  <span className="min-w-0"><span className="block truncate font-medium">{d.productName}</span><span className="block truncate text-xs text-muted-foreground">{d.customerName}</span></span>
                  <Badge variant="warning">{d.designerName ?? "Unassigned"}</Badge>
                </Link>
              </li>
            ))}
          </Section>
        )}
        {low && (
          <Section title="Running low" href="/inventory" empty={low.items.length === 0}>
            {low.items.map((r) => (
              <li key={r.variantId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="min-w-0"><span className="block truncate">{r.productName}</span><span className="block font-mono text-xs text-muted-foreground">{r.sku}</span></span>
                <Badge variant={r.available <= 0 ? "danger" : "warning"}>{r.available} left</Badge>
              </li>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
