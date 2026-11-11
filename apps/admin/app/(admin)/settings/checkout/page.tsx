import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import { getCheckoutSettings, razorpayGateway } from "@ecom/services";
import type { Metadata } from "next";
import { CheckoutSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Checkout settings" };

export default async function CheckoutSettingsPage() {
  await requireStaff("settings.manage");
  const settings = await getCheckoutSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Checkout settings" description="Shipping fees, cash on delivery, guest checkout and how long unpaid orders hold stock." />
      <CheckoutSettingsForm initial={settings} razorpayConfigured={!!razorpayGateway()} />
    </div>
  );
}