import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { StockView } from "./stock-view";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { actor } = await requireStaff("inventory.view");
  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Stock on hand, reserved by open orders, and what's left to sell. Lowest first." />
      <StockView canManage={can(actor, "inventory.manage")} />
    </div>
  );
}