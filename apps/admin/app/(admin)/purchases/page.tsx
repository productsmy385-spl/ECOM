import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { PurchasesView } from "./purchases-view";

export const metadata: Metadata = { title: "Purchases" };

export default async function PurchasesPage() {
  const { actor } = await requireStaff("inventory.view");
  return (
    <div className="space-y-6">
      <PageHeader title="Purchases" description="Stock ordered from suppliers. Receiving a purchase adds it to inventory." />
      <PurchasesView canManage={can(actor, "inventory.manage")} />
    </div>
  );
}