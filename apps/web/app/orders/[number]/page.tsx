import { getOrder, NotFoundError, razorpayGateway } from "@ecom/services";
import { formatDateIN, formatPaise } from "@ecom/ui/format";
import { AlertTriangle, CheckCircle2, Clock, MapPin, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/product-image";
import { getCustomer } from "@/lib/customer";
import { orderAccess } from "@/lib/order-access";
import { ORDER_STATUS } from "../status";
import { PayNow } from "./pay-now";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

type Search = { t?: string; placed?: string; paid?: string; pay?: string; payError?: string };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<Search> }) {
  const { number } = await params;
  const sp = await searchParams;
  const customer = await getCustomer();

  let order;
  try {
    order = await getOrder(await orderAccess(null, customer, undefined, sp.t ?? null), number);
  } catch (err) {
    if (err instanceof NotFoundError || (err as { status?: number }).status === 404) notFound();
    throw err;
  }
  const s = ORDER_STATUS[order.status] ?? { label: order.status, tone: "muted" as const };
  const canPay = order.status === "payment_pending" && !!order.payBy && order.payBy > new Date() && !!razorpayGateway();

  return (
    <div className="container-store max-w-4xl py-8 sm:py-12">
      {(sp.placed || sp.paid) && order.status !== "payment_pending" && (
        <div role="status" className="mb-6 flex gap-3 rounded-2xl bg-success/10 p-5">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-display text-lg font-semibold">Thank you! Your order is placed.</p>
            <p className="text-sm text-muted-foreground">
              {order.email || customer ? `We'll email updates${order.email ? ` to ${order.email}` : ""}. ` : ""}
              {sp.t ? "Bookmark this page: it's your private link to this order." : ""}
            </p>
          </div>
        </div>
      )}
      {sp.payError && order.status === "payment_pending" && (
        <p role="alert" className="mb-6 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" /> {sp.payError}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Order</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">Placed {formatDateIN(order.placedAt)}</p>
        </div>
        <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-semibold ${TONE[s.tone]}`}>{s.label}</span>
      </div>

      {order.status === "payment_pending" && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-warning/40 bg-warning/5 p-5 sm:flex-row sm:items-center">
          <Clock className="hidden h-6 w-6 shrink-0 text-warning sm:block" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Payment pending</p>
            <p className="text-muted-foreground">
              {order.payBy && order.payBy > new Date()
                ? `We're holding your items until ${order.payBy.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}. Complete payment to confirm the order.`
                : "The payment window has closed. This order will be cancelled shortly."}
            </p>
          </div>
          {canPay && <PayNow orderId={order.id} orderToken={sp.t} autoStart={!!sp.pay} brand={process.env.NEXT_PUBLIC_BRAND_NAME ?? "Store"} amount={order.amounts.total} />}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-border" aria-labelledby="items-h">
          <h2 id="items-h" className="flex items-center gap-2 border-b border-border px-5 py-4 font-display font-semibold">
            <Package className="h-5 w-5 text-primary" aria-hidden="true" /> Items
          </h2>
          <ul className="divide-y divide-border">
            {order.items.map((i) => (
              <li key={i.id} className="flex gap-4 p-5">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  <ProductImage src={i.imageUrl} alt="" sizes="80px" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{i.productName}</p>
                  <p className="text-muted-foreground">
                    {i.variantName} · Qty {i.quantity}
                  </p>
                  {i.summary.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{i.summary.map((x) => `${x.label}: ${x.value}`).join(" · ")}</p>}
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatPaise(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border p-5 text-sm" aria-labelledby="sum-h">
            <h2 id="sum-h" className="font-display font-semibold">
              Summary
            </h2>
            <dl className="mt-3 space-y-2">
              <Row label="Subtotal" value={formatPaise(order.amounts.subtotal)} />
              {order.amounts.discount > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`−${formatPaise(order.amounts.discount)}`} />}
              <Row label={`Shipping (${order.shippingMethod})`} value={order.amounts.shipping ? formatPaise(order.amounts.shipping) : "Free"} />
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatPaise(order.amounts.total)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">
                Includes {formatPaise(order.amounts.tax)} GST · {order.paymentMethod === "cod" ? "Cash on delivery" : "Paid online"}
              </p>
            </dl>
          </section>
          <section className="rounded-2xl border border-border p-5 text-sm" aria-labelledby="addr-h">
            <h2 id="addr-h" className="flex items-center gap-2 font-display font-semibold">
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" /> Delivering to
            </h2>
            <address className="mt-2 not-italic text-muted-foreground">
              <span className="font-medium text-foreground">{order.shippingAddress.fullName}</span>
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.phone}
            </address>
          </section>
          <section className="rounded-2xl border border-border p-5 text-sm" aria-labelledby="hist-h">
            <h2 id="hist-h" className="font-display font-semibold">
              Progress
            </h2>
            <ol className="mt-3 space-y-3 border-l-2 border-border pl-4">
              {order.history.map((h, i) => (
                <li key={i}>
                  <p className="font-medium">{ORDER_STATUS[h.status]?.label ?? h.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateIN(h.at)}
                    {h.note ? ` · ${h.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <p className="mt-8 text-sm">
        {customer ? (
          <Link href="/account/orders" className="font-semibold text-link hover:underline">
            ← All my orders
          </Link>
        ) : (
          <Link href="/shop" className="font-semibold text-link hover:underline">
            ← Continue shopping
          </Link>
        )}
      </p>
    </div>
  );
}

const TONE = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
} as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
