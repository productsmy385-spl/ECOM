import { getOrder, getStoreProfile, NotFoundError } from "@ecom/services";
import { brand } from "@ecom/ui/brand";
import { formatDateIN, formatPaise } from "@ecom/ui/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/customer";
import { orderAccess } from "@/lib/order-access";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

/** Customer copy of the invoice (GST-inclusive). The browser's print dialog saves it as PDF. */
export default async function InvoicePage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const { number } = await params;
  const { t } = await searchParams;
  const customer = await getCustomer();
  let o;
  try {
    o = await getOrder(await orderAccess(null, customer, undefined, t ?? null), number);
  } catch (err) {
    if (err instanceof NotFoundError || (err as { status?: number }).status === 404) notFound();
    throw err;
  }
  if (["pending", "payment_pending", "cancelled"].includes(o.status)) notFound();
  const seller = await getStoreProfile();
  const a = o.shippingAddress;

  return (
    <div className="container-store max-w-3xl py-8 text-sm print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <p className="text-muted-foreground">Use Print and choose &quot;Save as PDF&quot; to download.</p>
        <PrintButton />
      </div>
      <article className="rounded-2xl border border-border p-6 sm:p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-4">
          <div>
            <p className="font-display text-2xl font-bold">{brand.name}</p>
            {seller.address && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{seller.address}</p>}
            {seller.gstin && <p className="mt-1 text-xs">GSTIN: {seller.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">Invoice</p>
            <p className="font-mono">INV-{o.orderNumber.replace(/^ORD-/, "")}</p>
            <p className="text-xs text-muted-foreground">Order {o.orderNumber} · {formatDateIN(o.placedAt)}</p>
          </div>
        </header>
        <section className="grid gap-6 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill &amp; ship to</p>
            <p className="mt-1 font-medium">{a.fullName}</p>
            <p>
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
            </p>
            <p>
              {a.city}, {a.state} {a.postalCode}
            </p>
            <p>{a.phone}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
            <p className="mt-1">{o.paymentMethod === "cod" ? "Cash on delivery" : "Paid online"}</p>
            <p>Place of supply: {a.state}</p>
          </div>
        </section>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id} className="border-b border-border align-top">
                <td className="py-2 pr-2">
                  <p className="font-medium">{i.productName}</p>
                  <p className="text-xs text-muted-foreground">{i.variantName}</p>
                </td>
                <td className="py-2 pr-2 text-right">{i.quantity}</td>
                <td className="py-2 pr-2 text-right">{formatPaise(i.unitPrice + i.customizationPrice)}</td>
                <td className="py-2 text-right">{formatPaise(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 w-full max-w-xs space-y-1">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatPaise(o.amounts.subtotal)}</dd></div>
          {o.amounts.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>−{formatPaise(o.amounts.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{o.amounts.shipping ? formatPaise(o.amounts.shipping) : "Free"}</dd></div>
          <div className="flex justify-between border-t border-border pt-1 text-base font-bold"><dt>Total</dt><dd>{formatPaise(o.amounts.total)}</dd></div>
          <p className="text-xs text-muted-foreground">Prices include GST of {formatPaise(o.amounts.tax)}.</p>
        </dl>
        <p className="mt-8 text-xs text-muted-foreground">This is a computer-generated invoice. Thank you for shopping with {brand.name}.</p>
      </article>
    </div>
  );
}
