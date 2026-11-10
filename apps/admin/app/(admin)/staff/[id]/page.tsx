import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffDetailView } from "./staff-detail";

export const metadata: Metadata = { title: "Staff member" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { actor, user } = await requireStaff("staff.view");
  return (
    <StaffDetailView
      id={id}
      me={{ id: user.id, permissions: user.permissions, isSuperAdmin: user.isSuperAdmin }}
      canManage={can(actor, "staff.manage")}
    />
  );
}
