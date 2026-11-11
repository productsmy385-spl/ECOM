"use client";

import type { CartView as Cart } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { AlertTriangle, Loader2, Minus, Palette, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/lib/utils";

export function CartView({ initial }: { initial: Cart }) {
  const router = useRouter();
  const [cart, setCart] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  async function call(key: string, url: string, method: string, body?: unknown, onError?: (msg: string) => void) {
    setBusy(key);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as Cart & { error?: string };
    setBusy(null);
    if (!res?.ok) {
      (onError ?? setError)(json?.error ?? "Something went wrong. Please try again.");
      return false;
    }
    setCart(json);
    router.refresh(); // header count
    return true;
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <ShoppingBag className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 font-display text-lg font-semibold">Your bag is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">Find something you love, or design your own.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/shop" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Start shopping
          </Link>
          <Link href="/designs" className="inline-flex h-11 items-center justify-center rounded-lg border border-input px-6 text-sm font-semibold hover:border-primary">
            My designs
          </Link>
        </div>
      </div>
    );
  }

  const p = cart.pricing;
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
      <section aria-label="Items">
        {error && (
          <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex gap-4 p-4 sm:p-5">
              <Link href={`/products/${l.productSlug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-28 sm:w-28">
                <ProductImage src={l.imageUrl} alt={l.productName} sizes="112px" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/products/${l.productSlug}`} className="line-clamp-2 font-semibold hover:text-primary">
                      {l.productName}
                    </Link>
                    <p className="text-sm text-muted-foreground">{l.variantName}</p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatPaise(l.lineTotal)}</p>
                </div>
                {l.design && (
                  <div className="rounded-lg bg-blush-50 px-3 py-2 text-xs">
                    <Link href={`/designs/${l.design.id}`} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
                      <Palette className="h-3.5 w-3.5" aria-hidden="true" /> {l.design.name}
                    </Link>
                    <span className="text-muted-foreground"> · {l.design.approved ? "approved" : "checked by our designers before production"}</span>
                    {l.design.summary.length > 0 && (
                      <p className="mt-1 text-muted-foreground">{l.design.summary.map((s) => `${s.label}: ${s.value}`).join(" · ")}</p>
                    )}
                  </div>
                )}
                {l.customizationPrice > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatPaise(l.basePrice)} + {formatPaise(l.customizationPrice)} personalisation, each
                  </p>
                )}
                {l.issue && (
                  <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {l.issue}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="flex h-9 items-center rounded-lg border border-input" role="group" aria-label={`Quantity of ${l.productName}`}>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center disabled:opacity-40"
                      disabled={!!busy || l.quantity <= 1}
                      onClick={() => call(l.id, `/api/cart/items/${l.id}`, "PATCH", { quantity: l.quantity - 1 })}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
                      {busy === l.id ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : l.quantity}
                    </span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center disabled:opacity-40"
                      disabled={!!busy || l.quantity >= Math.min(10, Math.max(l.available, l.quantity))}
                      onClick={() => call(l.id, `/api/cart/items/${l.id}`, "PATCH", { quantity: l.quantity + 1 })}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => call(`rm-${l.id}`, `/api/cart/items/${l.id}`, "DELETE")}
                    disabled={!!busy}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Link href="/shop" className="mt-4 inline-block text-sm font-semibold text-link hover:underline">
          ← Continue shopping
        </Link>
      </section>

      <aside className="h-fit space-y-4 rounded-2xl border border-border p-5 lg:sticky lg:top-40" aria-label="Order summary">
        <h2 className="font-display text-lg font-semibold">Order summary</h2>

        {cart.couponCode ? (
          <div className={cn("flex items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-sm", cart.couponError ? "bg-warning/10" : "bg-success/10")}>
            <div>
              <p className="inline-flex items-center gap-1.5 font-semibold">
                <Tag className="h-4 w-4" aria-hidden="true" /> {cart.couponCode}
              </p>
              <p className={cn("text-xs", cart.couponError ? "text-warning" : "text-success")}>{cart.couponError ?? "Applied"}</p>
            </div>
            <button type="button" onClick={() => call("coupon", "/api/cart/coupon", "DELETE")} disabled={!!busy} aria-label="Remove code" className="rounded p-1 hover:bg-black/5">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form
            className="space-y-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              setCodeError(null);
              if (await call("coupon", "/api/cart/coupon", "POST", { code }, setCodeError)) setCode("");
            }}
          >
            <label htmlFor="coupon" className="text-sm font-medium">
              Promo code
            </label>
            <div className="flex gap-2">
              <input
                id="coupon"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                autoComplete="off"
                aria-invalid={!!codeError}
                aria-describedby={codeError ? "coupon-err" : undefined}
                className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-white px-3 text-sm uppercase outline-none focus:border-ring"
              />
              <button type="submit" disabled={!code.trim() || !!busy} className="h-10 rounded-lg border border-input px-4 text-sm font-semibold hover:border-primary disabled:opacity-50">
                {busy === "coupon" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </button>
            </div>
            {codeError && (
              <p id="coupon-err" role="alert" className="text-xs text-destructive">
                {codeError}
              </p>
            )}
          </form>
        )}

        <dl className="space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal ({cart.count} {cart.count === 1 ? "item" : "items"})</dt>
            <dd>{formatPaise(p.subtotal)}</dd>
          </div>
          {p.discount > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount</dt>
              <dd>−{formatPaise(p.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping (standard)</dt>
            <dd>{p.shipping === 0 ? <span className="font-semibold text-success">Free</span> : formatPaise(p.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatPaise(p.total)}</dd>
          </div>
          <p className="text-xs text-muted-foreground">Includes {formatPaise(p.taxAmount)} GST.</p>
        </dl>

        {p.freeShippingRemaining > 0 && (
          <p className="rounded-lg bg-blush-50 px-3 py-2 text-xs">
            Add <span className="font-semibold">{formatPaise(p.freeShippingRemaining)}</span> more for free standard shipping.
          </p>
        )}

        {cart.canCheckout ? (
          <Link href="/checkout" className="flex h-12 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Checkout
          </Link>
        ) : (
          <p role="status" className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            Fix the highlighted items to continue.
          </p>
        )}
        {cart.requiresDesignReview && <p className="text-xs text-muted-foreground">Personalised items are checked by our designers before production.</p>}
      </aside>
    </div>
  );
}
