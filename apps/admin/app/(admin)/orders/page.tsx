import { PageHeader } from "@/components/layout/page-header";
import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersList } from "./orders-list";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const { actor } = await requireStaffAny(["orders.view", "orders.view_assigned"]);
  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description={can(actor, "orders.view") ? "Every order, newest first." : "Orders assigned to you."} />
      <Suspense>
        <OrdersList />
      </Suspense>
    </div>
  );
}
