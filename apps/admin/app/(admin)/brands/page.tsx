import { PageHeader } from "@/components/layout/page-header";
import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { BrandsView } from "./brands-view";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  const { actor } = await requireStaffAny(["categories.manage", "products.view"]);
  return (
    <div className="space-y-6">
      <PageHeader title="Brands" description="Brands shoppers can filter by and browse." />
      <BrandsView canManage={can(actor, "categories.manage")} />
    </div>
  );
}
