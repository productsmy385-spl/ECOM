import { PageHeader } from "@/components/layout/page-header";
import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { PermissionMatrix } from "./permission-matrix";

export const metadata: Metadata = { title: "Permissions" };

export default async function PermissionsPage() {
  const { actor, user } = await requireStaffAny(["permissions.manage", "roles.manage"]);
  const canEdit = can(actor, "permissions.manage");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissions"
        description={
          canEdit
            ? "Tick what each role may do. Changes apply on each staff member's next request."
            : "Read-only: you need the “Change role permissions” permission to edit."
        }
      />
      <PermissionMatrix canEdit={canEdit} myPermissions={user.permissions} isSuperAdmin={user.isSuperAdmin} />
    </div>
  );
}
