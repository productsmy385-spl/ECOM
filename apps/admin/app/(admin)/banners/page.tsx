import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import { listBanners } from "@ecom/services";
import type { Metadata } from "next";
import { BannersManager } from "./banners-manager";

export const metadata: Metadata = { title: "Banners" };
export const dynamic = "force-dynamic";

export default async function BannersPage() {
  const { actor } = await requireStaff("marketing.manage");
  const banners = await listBanners({ actor });
  return (
    <div className="space-y-6">
      <PageHeader title="Banners" description="Home page hero slides and the offer banner. Schedule them with start and end dates; an end date also shows a countdown on the offer." />
      <BannersManager initial={JSON.parse(JSON.stringify(banners))} />
    </div>
  );
}
