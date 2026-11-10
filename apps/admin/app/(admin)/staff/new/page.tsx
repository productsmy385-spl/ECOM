import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";
import { NewStaff } from "./new-staff";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewStaffPage() {
  const { user } = await requireStaff("staff.manage");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add staff"
        description="They'll get an email with a link to set their own password. You never see or choose it."
      />
      <NewStaff myPermissions={user.permissions} isSuperAdmin={user.isSuperAdmin} />
    </div>
  );
}
