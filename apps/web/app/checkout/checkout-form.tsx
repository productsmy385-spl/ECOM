"use client";

import type { CartView, getCheckoutOptions, PlacedOrder } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { INDIAN_STATES } from "@ecom/validation";
import { Banknote, CreditCard, Loader2, Lock, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/auth/auth-shell";
import { ProductImage } from "@/components/product-image";
import { payWithRazorpay } from "@/lib/razorpay-client";
import { cn } from "@/lib/utils";

type Options = Awaited<ReturnType<typeof getCheckoutOptions>>;
type Saved = { id: string; label: string | null; fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; postalCode: string; isDefault: boolean };

const days = ([a, b]: number[]) => (a === b ? `${a} days` : `${a}–${b} days`);

export function CheckoutForm({
  initialCart,
  options,
  customer,
  savedAddresses,
  brand,
}: {
  initialCart: CartView;
  options: Options;
  customer: { name: string; email: string } | null;
  savedAddresses: Saved[];
  brand: string;
}) {
  const router = useRouter();
  // Full page loads after ordering: the header (bag count) lives in the root
  // layout, which client-side navigation would leave stale.
  const go = (url: string) => window.location.assign(url);
  const [cart, setCart] = useState(initialCart);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [addressId, setAddressId] = useState<string>(savedAddresses.find((a) => a.isDefault)?.id ?? savedAddresses[0]?.id ?? "new");
  const [method, setMethod] = useState<"standard" | "express">("standard");
  const codAllowed = options.codEnabled && cart.pricing.total <= options.codMaxAmount;
  const [payment, setPayment] = useState<"razorpay" | "cod" | null>(options.razorpayEnabled ? "razorpay" : codAllowed ? "cod" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function changeMethod(m: "standard" | "express") {
    setMethod(m);
    const res = await fetch(`/api/cart?shipping=${m}`).catch(() => null);
    if (res?.ok) setCart(await res.json());
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payment) return;
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    const body = {
      idempotencyKey,
      email: customer ? undefined : str("email"),
      ...(addressId !== "new"
        ? { savedAddressId: addressId }
        : {
            address: { fullName: str("fullName"), phone: str("phone"), line1: str("line1"), line2: str("line2"), landmark: str("landmark"), city: str("city"), state: str("state"), postalCode: str("postalCode") },
            saveAddress: f.get("saveAddress") === "on",
          }),
      shippingMethod: method,
      paymentMethod: payment,
      note: str("note"),
    };
    setBusy(true);
    setError(null);
    setErrors({});
    const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as PlacedOrder & { error?: string; fieldErrors?: Record<string, string[]> };
    if (!res?.ok) {
      setBusy(false);
      const fe = Object.fromEntries(Object.entries(json.fieldErrors ?? {}).map(([k, v]) => [k.replace(/^address\./, ""), v?.[0] ?? ""]));
      setErrors(fe);
      setError(json.error ?? "Couldn't place your order. Please try again.");
      if (res?.status === 409) router.refresh();
      return;
    }
    const orderUrl = `/orders/${json.orderNumber}${json.orderToken ? `?t=${json.orderToken}` : ""}`;
    if (json.paymentMethod === "razorpay") {
      if (!json.payment) {
        go(`${orderUrl}${json.orderToken ? "&" : "?"}pay=1`);
        return;
      }
      try {
        const outcome = await payWithRazorpay(json.payment, { orderId: json.orderId, orderToken: json.orderToken }, brand);
        go(outcome === "paid" ? `${orderUrl}${json.orderToken ? "&" : "?"}paid=1` : orderUrl);
      } catch (err) {
        go(`${orderUrl}${json.orderToken ? "&" : "?"}payError=${encodeURIComponent((err as Error).message)}`);
      }
      return;
    }
    go(`${orderUrl}${json.orderToken ? "&" : "?"}placed=1`);
  }

  const p = cart.pricing;
  const section = "rounded-2xl border border-border p-5 sm:p-6";
  const radio = (on: boolean) => cn("flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors", on ? "border-primary bg-primary/5" : "border-input hover:border-foreground/30");

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <section className={section} aria-labelledby="contact-h">
          <h2 id="contact-h" className="font-display text-lg font-semibold">
            Contact
          </h2>
          {customer ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Order updates go to <span className="font-medium text-foreground">{customer.email}</span>.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} hint="For your order confirmation and updates." />
              <p className="text-sm text-muted-foreground">
                Have an account?{" "}
                <Link href="/login?next=%2Fcheckout" className="font-semibold text-link hover:underline">
                  Sign in
                </Link>{" "}
                to use saved addresses.
              </p>
            </div>
          )}
        </section>

        <section className={section} aria-labelledby="addr-h">
          <h2 id="addr-h" className="flex items-center gap-2 font-display text-lg font-semibold">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" /> Delivery address
          </h2>
          {savedAddresses.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
              {savedAddresses.map((a) => (
                <label key={a.id} className={radio(addressId === a.id)}>
                  <input type="radio" name="addressChoice" className="mt-1 accent-primary" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span className="text-sm">
                    <span className="font-semibold">{a.label ?? a.fullName}</span>
                    <span className="block text-muted-foreground">
                      {a.fullName}, {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.postalCode}
                    </span>
                  </span>
                </label>
              ))}
              <label className={radio(addressId === "new")}>
                <input type="radio" name="addressChoice" className="mt-1 accent-primary" checked={addressId === "new"} onChange={() => setAddressId("new")} />
                <span className="text-sm font-semibold">Use a new address</span>
              </label>
            </div>
          )}
          {addressId === "new" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="fullName" autoComplete="name" defaultValue={customer?.name ?? ""} error={errors.fullName} />
              <Field label="Mobile number" name="phone" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" error={errors.phone} />
              <div className="sm:col-span-2">
                <Field label="Address line 1" name="line1" autoComplete="address-line1" placeholder="House no., building, street" error={errors.line1} />
              </div>
              <Field label="Address line 2 (optional)" name="line2" autoComplete="address-line2" error={errors.line2} />
              <Field label="Landmark (optional)" name="landmark" error={errors.landmark} />
              <Field label="City" name="city" autoComplete="address-level2" error={errors.city} />
              <div className="space-y-1.5">
                <label htmlFor="state" className="block text-sm font-medium">
                  State
                </label>
                <select id="state" name="state" defaultValue="" autoComplete="address-level1" aria-invalid={!!errors.state} className={cn("h-11 w-full rounded-lg border bg-white px-3 text-sm", errors.state ? "border-destructive" : "border-input")}>
                  <option value="" disabled>
                    Choose a state
                  </option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
              </div>
              <Field label="PIN code" name="postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={6} error={errors.postalCode} />
              {customer && (
                <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
                  <input type="checkbox" name="saveAddress" defaultChecked className="h-4 w-4 accent-primary" /> Save this address to my account
                </label>
              )}
            </div>
          )}
        </section>

        <section className={section} aria-labelledby="ship-h">
          <h2 id="ship-h" className="flex items-center gap-2 font-display text-lg font-semibold">
            <Truck className="h-5 w-5 text-primary" aria-hidden="true" /> Shipping
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Shipping method">
            <label className={radio(method === "standard")}>
              <input type="radio" name="shipping" className="mt-1 accent-primary" checked={method === "standard"} onChange={() => changeMethod("standard")} />
              <span className="text-sm">
                <span className="font-semibold">Standard</span> · {days(options.standardDays)}
                <span className="block text-muted-foreground">
                  {p.subtotal - p.discount >= options.freeShippingThreshold ? "Free" : formatPaise(options.standardFee)}
                </span>
              </span>
            </label>
            <label className={radio(method === "express")}>
              <input type="radio" name="shipping" className="mt-1 accent-primary" checked={method === "express"} onChange={() => changeMethod("express")} />
              <span className="text-sm">
                <span className="font-semibold">Express</span> · {days(options.expressDays)}
                <span className="block text-muted-foreground">{formatPaise(options.expressFee)}</span>
              </span>
            </label>
          </div>
          {cart.requiresDesignReview && <p className="mt-3 text-xs text-muted-foreground">Personalised items start production after our designers check them, which can add a day or two.</p>}
        </section>

        <section className={section} aria-labelledby="pay-h">
          <h2 id="pay-h" className="font-display text-lg font-semibold">
            Payment
          </h2>
          {!options.razorpayEnabled && !codAllowed ? (
            <p role="alert" className="mt-3 rounded-lg bg-warning/10 px-3 py-2.5 text-sm">
              Payments aren&apos;t open yet. Please check back soon or contact us to order.
            </p>
          ) : (
            <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Payment method">
              {options.razorpayEnabled && (
                <label className={radio(payment === "razorpay")}>
                  <input type="radio" name="payment" className="mt-1 accent-primary" checked={payment === "razorpay"} onChange={() => setPayment("razorpay")} />
                  <span className="text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <CreditCard className="h-4 w-4" aria-hidden="true" /> Pay online
                    </span>
                    <span className="block text-muted-foreground">UPI, cards, net banking and wallets, via Razorpay.</span>
                  </span>
                </label>
              )}
              {options.codEnabled && (
                <label className={cn(radio(payment === "cod"), !codAllowed && "cursor-not-allowed opacity-50")}>
                  <input type="radio" name="payment" className="mt-1 accent-primary" disabled={!codAllowed} checked={payment === "cod"} onChange={() => setPayment("cod")} />
                  <span className="text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Banknote className="h-4 w-4" aria-hidden="true" /> Cash on delivery
                    </span>
                    <span className="block text-muted-foreground">
                      {codAllowed ? "Pay when your order arrives." : `Available on orders up to ${formatPaise(options.codMaxAmount, { whole: true })}.`}
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}
          <div className="mt-4 space-y-1.5">
            <label htmlFor="note" className="block text-sm font-medium">
              Note for us (optional)
            </label>
            <textarea id="note" name="note" rows={2} maxLength={500} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-ring" />
          </div>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-border p-5 lg:sticky lg:top-40" aria-label="Order summary">
        <h2 className="font-display text-lg font-semibold">Your order</h2>
        <ul className="space-y-3">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex gap-3 text-sm">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                <ProductImage src={l.imageUrl} alt="" sizes="56px" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-2xs font-bold text-white">{l.quantity}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium">{l.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {l.variantName}
                  {l.design ? ` · ${l.design.name}` : ""}
                </p>
              </div>
              <p className="shrink-0 font-medium">{formatPaise(l.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatPaise(p.subtotal)}</dd>
          </div>
          {p.discount > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount {cart.couponCode ? `(${cart.couponCode})` : ""}</dt>
              <dd>−{formatPaise(p.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>{p.shipping === 0 ? <span className="font-semibold text-success">Free</span> : formatPaise(p.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatPaise(p.total)}</dd>
          </div>
          <p className="text-xs text-muted-foreground">Includes {formatPaise(p.taxAmount)} GST.</p>
        </dl>
        <button
          type="submit"
          disabled={busy || !payment}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
          {payment === "cod" ? "Place order" : `Pay ${formatPaise(p.total)}`}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/cart" className="hover:underline">
            ← Back to bag
          </Link>
        </p>
      </aside>
    </form>
  );
}
