"use client";

import { Check, Loader2, Palette, ShoppingBag, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const cls = "relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white transition-colors duration-300 hover:bg-primary disabled:opacity-60";

/** Card action: adds single-variant products straight to the bag; otherwise opens the product to choose. */
export function QuickAdd({ variantId, slug, name, customizable, inStock }: { variantId: string | null; slug: string; name: string; customizable: boolean; inStock: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  if (!variantId || !inStock) {
    return (
      <Link href={`/products/${slug}`} className={cls} aria-label={customizable ? `Customise ${name}` : `Choose options for ${name}`} title={customizable ? "Customise" : "Choose options"}>
        {customizable ? <Palette className="h-4 w-4" aria-hidden="true" /> : <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      disabled={state === "busy"}
      aria-label={state === "done" ? `${name} added to bag` : `Add ${name} to bag`}
      title="Add to bag"
      onClick={async (e) => {
        e.preventDefault();
        setState("busy");
        const res = await fetch("/api/cart/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, quantity: 1 }) }).catch(() => null);
        if (!res?.ok) {
          setState("idle");
          router.push(`/products/${slug}`);
          return;
        }
        setState("done");
        router.refresh();
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "done" ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
