import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductsList } from "./products-list";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const { actor } = await requireStaff("products.view");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Everything in the catalogue, published or not."
        actions={
          can(actor, "products.create") ? (
            <Link href="/products/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Add product
            </Link>
          ) : undefined
        }
      />
      <ProductsList />
    </div>
  );
}
