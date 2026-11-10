import { PageHeader } from "@/components/layout/page-header";
import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { RolesView } from "./roles-view";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  const { actor } = await requireStaffAny(["roles.manage", "permissions.manage", "staff.view"]);
  return (
    <div className="space-y-6">
      <PageHeader title="Roles" description="Group permissions into roles, then give roles to staff." />
      <RolesView canManage={can(actor, "roles.manage")} canEditPermissions={can(actor, "permissions.manage")} />
    </div>
  );
}
