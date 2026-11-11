import { PageHeader } from "@/components/layout/page-header";
import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { DesignsList } from "./designs-list";

export const metadata: Metadata = { title: "Designs" };

export default async function DesignsPage() {
  const { actor } = await requireStaffAny(["designs.view", "designs.view_assigned"]);
  const all = can(actor, "designs.view");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Designs"
        description={all ? "Customer designs submitted for review." : "Designs assigned to you."}
      />
      <DesignsList canSeeAll={all} />
    </div>
  );
}
