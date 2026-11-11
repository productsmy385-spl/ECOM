import { PageHeader } from "@/components/layout/page-header";
import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { DeliveriesView } from "./deliveries-view";

export const metadata: Metadata = { title: "Deliveries" };

export default async function DeliveriesPage() {
  const { actor } = await requireStaffAny(["deliveries.view", "deliveries.view_assigned"]);
  const manager = can(actor, "deliveries.view");
  return (
    <div className="space-y-6">
      <PageHeader title={manager ? "Deliveries" : "My deliveries"} description={manager ? "Packed orders on their way to customers. Assign each one to a captain." : "Your deliveries, active ones first."} />
      <DeliveriesView manager={manager} />
    </div>
  );
}