import { PageHeader } from "@/components/layout/page-header";
import { GradientCard } from "@/components/ui/gradient-card";
import { requireStaff } from "@/lib/session";
import { paymentSummary } from "@ecom/services";
import { formatNumberIN, formatPaise } from "@ecom/ui/format";
import { Banknote, CreditCard, RotateCcw, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { PaymentsList } from "./payments-list";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { actor } = await requireStaff("payments.view");
  const s = await paymentSummary({ actor });
  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Online and cash-on-delivery payments. Refunds are issued from the order." />
      <section aria-label="Payment summary" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientCard title="Collected" value={formatPaise(s.collected, { whole: true })} icon={<Banknote />} variant="primary" hint="Net of refunds" />
        <GradientCard title="Online (Razorpay)" value={formatPaise(s.online, { whole: true })} icon={<CreditCard />} variant="info" hint={`Cash on delivery: ${formatPaise(s.cod, { whole: true })}`} />
        <GradientCard title="Refunded" value={formatPaise(s.refunded, { whole: true })} icon={<RotateCcw />} variant="warning" hint="Returned to customers" />
        <GradientCard title="Failed payments" value={formatNumberIN(s.failed)} icon={<XCircle />} variant="dark" hint="Attempts that didn't go through" />
      </section>
      <PaymentsList />
    </div>
  );
}
