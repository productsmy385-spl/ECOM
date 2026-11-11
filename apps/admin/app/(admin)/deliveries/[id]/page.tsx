import { requireStaffAny } from "@/lib/session";
import type { Metadata } from "next";
import { DeliveryDetail } from "./delivery-detail";

export const metadata: Metadata = { title: "Delivery" };

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffAny(["deliveries.view", "deliveries.view_assigned"]);
  const { id } = await params;
  return <DeliveryDetail id={id} />;
}