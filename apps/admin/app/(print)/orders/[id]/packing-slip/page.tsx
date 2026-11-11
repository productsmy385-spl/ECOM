import { requireStaffAny } from "@/lib/session";
import { getOrderAdmin, getStoreProfile, NotFoundError } from "@ecom/services";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDoc } from "../print-doc";

export const metadata: Metadata = { title: "Packing slip" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireStaffAny(["orders.view", "orders.view_assigned"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let order;
  try {
    order = await getOrderAdmin({ actor }, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const seller = await getStoreProfile();
  return <PrintDoc order={order} kind="slip" seller={seller} />;
}