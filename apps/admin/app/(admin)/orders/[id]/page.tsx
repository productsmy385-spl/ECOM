import { requireStaffAny } from "@/lib/session";
import { can } from "@ecom/rbac";
import type { Metadata } from "next";
import { OrderDetail } from "./order-detail";

export const metadata: Metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireStaffAny(["orders.view", "orders.view_assigned"]);
  const { id } = await params;
  return (
    <OrderDetail
      id={id}
      can={{
        update: can(actor, "orders.update"),
        cancel: can(actor, "orders.cancel"),
        assign: can(actor, "orders.assign"),
        refund: can(actor, "payments.refund"),
        designs: can(actor, "designs.view") || can(actor, "designs.view_assigned"),
        customers: can(actor, "customers.view"),
      }}
    />
  );
}
