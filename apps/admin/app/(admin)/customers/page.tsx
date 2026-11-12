import { PageHeader } from "@/components/layout/page-header";
import { GradientCard } from "@/components/ui/gradient-card";
import { requireStaff } from "@/lib/session";
import { customerSummary } from "@ecom/services";
import { formatNumberIN } from "@ecom/ui/format";
import { Repeat, ShoppingBag, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import { CustomersList } from "./customers-list";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { actor } = await requireStaff("customers.view");
  const s = await customerSummary({ actor });
  const repeatRate = s.buyers ? Math.round((s.repeat / s.buyers) * 100) : 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Shoppers with an account. Guests appear on their orders only." />
      <section aria-label="Customer summary" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientCard title="Customers" value={formatNumberIN(s.total)} icon={<Users />} variant="primary" hint="Accounts in total" />
        <GradientCard title="New this month" value={formatNumberIN(s.newThisMonth)} icon={<UserPlus />} variant="info" hint="Signed up since the 1st" />
        <GradientCard title="Have ordered" value={formatNumberIN(s.buyers)} icon={<ShoppingBag />} variant="success" hint={`${s.total ? Math.round((s.buyers / s.total) * 100) : 0}% of accounts`} />
        <GradientCard title="Repeat buyers" value={formatNumberIN(s.repeat)} icon={<Repeat />} variant="warning" hint={`${repeatRate}% of buyers came back`} />
      </section>
      <CustomersList />
    </div>
  );
}
