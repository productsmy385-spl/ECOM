import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import { getWebsiteSettings } from "@ecom/services";
import type { Metadata } from "next";
import { WebsiteSettingsForm } from "./website-form";

export const metadata: Metadata = { title: "Website settings" };
export const dynamic = "force-dynamic";

export default async function WebsiteSettingsPage() {
  await requireStaff("settings.manage");
  const settings = await getWebsiteSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Website settings" description="Choose a template for the storefront, arrange the home page and set your contact details, social links and SEO." />
      <WebsiteSettingsForm initial={settings} storefrontUrl={process.env.WEB_URL ?? "http://localhost:3000"} />
    </div>
  );
}
