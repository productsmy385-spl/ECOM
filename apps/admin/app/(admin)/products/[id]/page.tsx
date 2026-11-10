import { EmptyState } from "@/components/ui/empty-state";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import { getProductAdmin, NotFoundError } from "@ecom/services";
import { PackageX } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductEditor } from "../product-editor";

export const metadata: Metadata = { title: "Edit product" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { actor } = await requireStaff("products.view");
  let product;
  try {
    // Server-side read through the same permission-checked service.
    product = await getProductAdmin({ actor }, id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return <EmptyState icon={<PackageX className="h-8 w-8" />} title="Product not found" description="It may have been deleted." />;
    }
    throw err;
  }
  return (
    <ProductEditor
      key={product.updatedAt.toISOString()}
      product={JSON.parse(JSON.stringify(product))}
      webUrl={process.env.WEB_URL ?? ""}
      can={{
        create: can(actor, "products.create"),
        update: can(actor, "products.update"),
        publish: can(actor, "products.publish"),
        delete: can(actor, "products.delete"),
        stock: can(actor, "inventory.manage"),
      }}
    />
  );
}
