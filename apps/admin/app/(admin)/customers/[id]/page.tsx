import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { CustomerDetail } from "./customer-detail";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireStaff("customers.view");
  const { id } = await params;
  return <CustomerDetail id={id} canUpdate={can(actor, "customers.update")} canOrders={can(actor, "orders.view")} />;
}