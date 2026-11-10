import { PageHeader } from "@/components/layout/page-header";
import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { CategoriesView } from "./categories-view";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { actor } = await requireStaffAny(["categories.manage", "products.view"]);
  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="How products are grouped in the store's navigation and filters." />
      <CategoriesView canManage={can(actor, "categories.manage")} />
    </div>
  );
}
