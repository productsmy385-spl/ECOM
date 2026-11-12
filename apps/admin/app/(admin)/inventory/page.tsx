import { PageHeader } from "@/components/layout/page-header";
import { GradientCard } from "@/components/ui/gradient-card";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import { inventorySummary } from "@ecom/services";
import { formatNumberIN, formatPaise } from "@ecom/ui/format";
import { AlertTriangle, Boxes, IndianRupee, PackageX } from "lucide-react";
import type { Metadata } from "next";
import { StockView } from "./stock-view";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const { actor } = await requireStaff("inventory.view");
  const s = await inventorySummary({ actor });
  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Stock on hand, reserved by open orders, and what's left to sell. Lowest first." />
      <section aria-label="Stock summary" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientCard title="Units on hand" value={formatNumberIN(s.units)} icon={<Boxes />} variant="primary" hint={`${formatNumberIN(s.variants)} variants tracked`} />
        <GradientCard title="Stock value" value={formatPaise(s.retailValue, { whole: true })} icon={<IndianRupee />} variant="info" hint="At selling price" />
        <GradientCard title="Running low" value={formatNumberIN(s.low)} icon={<AlertTriangle />} variant="warning" hint="At or below minimum" />
        <GradientCard title="Out of stock" value={formatNumberIN(s.out)} icon={<PackageX />} variant="dark" hint="Nothing left to sell" />
      </section>
      <StockView canManage={can(actor, "inventory.manage")} />
    </div>
  );
}
