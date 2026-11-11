import { listCustomerOrders } from "@ecom/services";
import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomer } from "@/lib/customer";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "New support request", robots: { index: false } };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const c = await requireCustomer("/account/support/new");
  const { order } = await searchParams;
  const orders = (await listCustomerOrders(c.userId)).slice(0, 30).map((o) => o.orderNumber);
  return (
    <section className="space-y-4" aria-labelledby="new-h">
      <Link href="/account/support" className="text-sm text-muted-foreground hover:text-foreground">
        ← Help &amp; support
      </Link>
      <h2 id="new-h" className="font-display text-lg font-semibold">
        How can we help?
      </h2>
      <NewTicketForm orders={orders} initialOrder={order && orders.includes(order) ? order : ""} />
    </section>
  );
}
