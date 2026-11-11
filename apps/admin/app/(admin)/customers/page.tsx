import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";
import { CustomersList } from "./customers-list";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  await requireStaff("customers.view");
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Shoppers with an account. Guests appear on their orders only." />
      <CustomersList />
    </div>
  );
}