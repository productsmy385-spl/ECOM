import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StaffList } from "./staff-list";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { actor } = await requireStaff("staff.view");
  const canManage = can(actor, "staff.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="People who can sign in to the admin, and what they can do."
        actions={
          canManage ? (
            <Link href="/staff/new" className={buttonVariants()}>
              <UserPlus className="h-4 w-4" /> Add staff
            </Link>
          ) : undefined
        }
      />
      <StaffList />
    </div>
  );
}
