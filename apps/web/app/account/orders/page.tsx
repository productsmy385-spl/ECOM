import { listCustomerOrders } from "@ecom/services";
import { formatDateIN, formatPaise } from "@ecom/ui/format";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomer } from "@/lib/customer";
import { ORDER_STATUS } from "../../orders/status";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

export default async function MyOrdersPage() {
  const c = await requireCustomer("/account/orders");
  const orders = await listCustomerOrders(c.userId);
  return (
    <section className="space-y-4" aria-labelledby="orders-h">
      <h2 id="orders-h" className="font-display text-lg font-semibold">
        My orders
      </h2>
      {orders.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Package className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 font-semibold">No orders yet</p>
          <Link href="/shop" className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {orders.map((o) => {
            const s = ORDER_STATUS[o.status];
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.orderNumber}`} className="flex flex-col gap-1 p-4 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{o.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateIN(o.placedAt)} · {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:text-right">
                    <span className="text-sm font-medium">{s?.label ?? o.status}</span>
                    <span className="font-semibold">{formatPaise(o.total)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
