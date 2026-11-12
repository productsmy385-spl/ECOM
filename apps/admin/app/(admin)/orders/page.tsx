import { PageHeader } from "@/components/layout/page-header";
import { GradientCard } from "@/components/ui/gradient-card";
import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import { orderSummary } from "@ecom/services";
import { formatNumberIN, formatPaise } from "@ecom/ui/format";
import { CheckCircle2, Clock, IndianRupee, ShoppingBag, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersList } from "./orders-list";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { actor } = await requireStaffAny(["orders.view", "orders.view_assigned"]);
  const s = await orderSummary({ actor });
  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description={can(actor, "orders.view") ? "Track and manage every customer order." : "Orders assigned to you."} />
      <section aria-label="Order summary" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {s.revenue !== null ? (
          <GradientCard title="Paid order value" value={formatPaise(s.revenue, { whole: true })} icon={<IndianRupee />} variant="primary" hint="Captured payments" />
        ) : (
          <GradientCard title="Awaiting payment" value={formatNumberIN(s.awaitingPayment)} icon={<Wallet />} variant="primary" hint="Online orders not yet paid" />
        )}
        <GradientCard title="Total orders" value={formatNumberIN(s.total)} icon={<ShoppingBag />} variant="info" hint="Placed and confirmed" />
        <GradientCard title="In progress" value={formatNumberIN(s.inProgress)} icon={<Clock />} variant="warning" hint="Confirmed, not yet shipped" />
        <GradientCard title="Delivered" value={formatNumberIN(s.delivered)} icon={<CheckCircle2 />} variant="success" hint="Completed orders" />
      </section>
      <Suspense>
        <OrdersList stages={s.stages} />
      </Suspense>
    </div>
  );
}
