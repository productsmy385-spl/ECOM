import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import { getProductAdmin, listProductOptions, NotFoundError } from "@ecom/services";
import { PackageX } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OptionsBuilder } from "./options-builder";

export const metadata: Metadata = { title: "Customisation options" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(actor: Parameters<typeof getProductAdmin>[0]["actor"], id: string) {
  try {
    return await Promise.all([getProductAdmin({ actor }, id), listProductOptions({ actor }, id)]);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export default async function CustomizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { actor } = await requireStaff("products.view");
  const data = await load(actor, id);
  if (!data) {
    return <EmptyState icon={<PackageX className="h-8 w-8" />} title="Product not found" description="It may have been deleted." />;
  }
  const [product, options] = data;
  return (
    <OptionsBuilder
      product={{ id: product.id, name: product.name, slug: product.slug, status: product.status, requiresDesignReview: product.requiresDesignReview }}
      initial={JSON.parse(JSON.stringify(options))}
      canEdit={can(actor, "products.update")}
      webUrl={process.env.WEB_URL ?? ""}
    />
  );
}
