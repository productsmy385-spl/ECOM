import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";
import { CouponsView } from "./coupons-view";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireStaff("marketing.manage");
  return (
    <div className="space-y-6">
      <PageHeader title="Coupons" description="Promo codes shoppers can apply in their bag. Usage is counted when an order is placed." />
      <CouponsView />
    </div>
  );
}