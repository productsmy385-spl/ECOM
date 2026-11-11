import type { AdminOrderDetail } from "@ecom/services";
import { formatDateIN, formatPaise } from "@ecom/ui/format";
import { PrintButton } from "./print-button";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Store";

/** Tax invoice (GST-inclusive prices) or packing slip for one order. */
export function PrintDoc({ order: o, kind, seller }: { order: AdminOrderDetail; kind: "invoice" | "slip"; seller: { gstin: string; address: string } }) {
  const a = o.shippingAddress;
  const invoice = kind === "invoice";
  return (
    <div className="mx-auto max-w-3xl p-8 text-sm print:p-0">
      <div className="mb-6 flex items-start justify-between gap-6 print:hidden">
        <p className="text-muted-foreground">Use your browser&apos;s print dialog to save as PDF.</p>
        <PrintButton />
      </div>
      <header className="flex items-start justify-between gap-6 border-b border-black/20 pb-4">
        <div>
          <p className="font-display text-2xl font-bold">{brand}</p>
          {seller.address && <p className="mt-1 whitespace-pre-line text-xs text-black/70">{seller.address}</p>}
          {invoice && <p className="mt-1 text-xs">GSTIN: {seller.gstin || "Not set (Settings → store.gstin)"}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{invoice ? "Tax invoice" : "Packing slip"}</p>
          <p className="font-mono">{o.orderNumber}</p>
          <p className="text-xs text-black/70">Order date: {formatDateIN(o.placedAt)}</p>
          {invoice && <p className="text-xs text-black/70">Invoice no.: INV-{o.orderNumber.replace(/^ORD-/, "")}</p>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-black/60">{invoice ? "Bill & ship to" : "Ship to"}</p>
          <p className="mt-1 font-medium">{a.fullName}</p>
          <p>
            {a.line1}
            {a.line2 ? `, ${a.line2}` : ""}
            {a.landmark ? `, ${a.landmark}` : ""}
          </p>
          <p>
            {a.city}, {a.state} {a.postalCode}
          </p>
          <p>{a.phone}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/60">Details</p>
          <p className="mt-1">Payment: {o.paymentProvider === "cod" ? "Cash on delivery" : "Prepaid (online)"}</p>
          <p>Shipping: {o.shippingMethod}</p>
          {invoice && <p>Place of supply: {a.state}</p>}
        </div>
      </section>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-black/30 text-xs uppercase tracking-wide">
            <th className="py-2 pr-2">Item</th>
            <th className="py-2 pr-2">SKU</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            {invoice && (
              <>
                <th className="py-2 pr-2 text-right">Unit price</th>
                <th className="py-2 pr-2 text-right">GST</th>
                <th className="py-2 text-right">Amount</th>
              </>
            )}
            {!invoice && <th className="py-2 text-right">Packed ✓</th>}
          </tr>
        </thead>
        <tbody>
          {o.items.map((i) => (
            <tr key={i.id} className="border-b border-black/10 align-top">
              <td className="py-2 pr-2">
                <p className="font-medium">{i.productName}</p>
                <p className="text-xs text-black/70">{i.variantName}</p>
                {i.summary.length > 0 && <p className="text-xs text-black/70">{i.summary.map((s) => `${s.label}: ${s.value}`).join(" · ")}</p>}
              </td>
              <td className="py-2 pr-2 font-mono text-xs">{i.sku}</td>
              <td className="py-2 pr-2 text-right">{i.quantity}</td>
              {invoice && (
                <>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatPaise(i.unitPrice + i.customizationPrice)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {(i.taxRateBps / 100).toFixed(i.taxRateBps % 100 ? 2 : 0)}%<br />
                    <span className="text-xs text-black/70">{formatPaise(i.taxAmount)}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatPaise(i.lineTotal)}</td>
                </>
              )}
              {!invoice && <td className="py-2 text-right">☐</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {invoice && (
        <dl className="ml-auto mt-4 w-72 space-y-1">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatPaise(o.amounts.subtotal)}</dd></div>
          {o.amounts.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd className="tabular-nums">−{formatPaise(o.amounts.discount)}</dd></div>}
          <div className="flex justify-between"><dt>Shipping</dt><dd className="tabular-nums">{formatPaise(o.amounts.shipping)}</dd></div>
          <div className="flex justify-between border-t border-black/30 pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPaise(o.amounts.total)}</dd></div>
          <p className="text-right text-xs text-black/70">Prices include GST of {formatPaise(o.amounts.tax)}.</p>
        </dl>
      )}

      <footer className="mt-10 border-t border-black/20 pt-3 text-xs text-black/60">
        {invoice ? "This is a computer-generated invoice and does not need a signature." : `${o.items.reduce((s, i) => s + i.quantity, 0)} item(s). Check custom designs against the approved artwork before packing.`}
      </footer>
    </div>
  );
}
