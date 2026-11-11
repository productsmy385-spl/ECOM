import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { SuppliersView } from "./suppliers-view";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const { actor } = await requireStaff("inventory.view");
  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" description="Where your frames, mouldings, glass and resin materials come from." />
      <SuppliersView canManage={can(actor, "inventory.manage")} />
    </div>
  );
}