import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";
import { PaymentsList } from "./payments-list";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  await requireStaff("payments.view");
  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Online and cash-on-delivery payments. Refunds are issued from the order." />
      <PaymentsList />
    </div>
  );
}