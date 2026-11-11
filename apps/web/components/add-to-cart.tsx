"use client";

import { Check, Loader2, Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const MAX = 10;

/** Quantity stepper + "Add to bag". Optionally adds a finished design. */
export function AddToCart({
  variantId,
  designId,
  disabled,
  disabledLabel = "Out of stock",
  withQuantity = true,
  className,
}: {
  variantId: string;
  designId?: string;
  disabled?: boolean;
  disabledLabel?: string;
  withQuantity?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<"idle" | "busy" | "added">("idle");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setState("busy");
    setError(null);
    const res = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, quantity: qty, ...(designId ? { designId } : {}) }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!res?.ok) {
      setState("idle");
      setError(body?.error ?? "Couldn't add to bag. Please try again.");
      return;
    }
    setState("added");
    router.refresh(); // header count
  }

  const step = "flex h-11 w-11 items-center justify-center text-foreground disabled:opacity-40";
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        {withQuantity && !disabled && (
          <div className="flex h-11 w-full items-center justify-between rounded-lg border border-input sm:w-auto" role="group" aria-label="Quantity">
            <button type="button" className={step} onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">
              <Minus className="h-4 w-4" />
            </button>
            <output className="w-8 text-center text-sm font-semibold" aria-live="polite">
              {qty}
            </output>
            <button type="button" className={step} onClick={() => setQty((q) => Math.min(MAX, q + 1))} disabled={qty >= MAX} aria-label="Increase quantity">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={add}
          disabled={disabled || state === "busy"}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-semibold text-white hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
        >
          {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
          {disabled ? disabledLabel : "Add to bag"}
        </button>
      </div>
      {state === "added" && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-success">
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4" aria-hidden="true" /> Added to your bag.
          </span>
          <Link href="/cart" className="font-semibold text-link hover:underline">
            View bag &amp; checkout
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function CartHeaderLink({ count }: { count: number }) {
  return (
    <Link href="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted" aria-label={`Bag${count ? ` (${count} items)` : ""}`}>
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
