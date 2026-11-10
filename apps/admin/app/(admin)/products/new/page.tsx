import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { ProductEditor } from "../product-editor";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const { actor } = await requireStaff("products.create");
  return (
    <ProductEditor
      webUrl={process.env.WEB_URL ?? ""}
      can={{
        create: true,
        update: can(actor, "products.update"),
        publish: can(actor, "products.publish"),
        delete: can(actor, "products.delete"),
        stock: can(actor, "inventory.manage"),
      }}
    />
  );
}
