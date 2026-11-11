"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface WishlistState {
  signedIn: boolean;
  has: (productId: string) => boolean;
  count: number;
  toggle: (productId: string) => Promise<void>;
}

const Ctx = createContext<WishlistState | null>(null);

/** Seeded from the server layout; updates optimistically and rolls back on failure. */
export function WishlistProvider({ signedIn, initialIds, children }: { signedIn: boolean; initialIds: string[]; children: React.ReactNode }) {
  const [ids, setIds] = useState(() => new Set(initialIds));
  const router = useRouter();
  const path = usePathname();

  const toggle = useCallback(
    async (productId: string) => {
      if (!signedIn) {
        router.push(`/login?next=${encodeURIComponent(path)}`);
        return;
      }
      const saved = ids.has(productId);
      const flip = (s: Set<string>) => {
        const n = new Set(s);
        if (n.has(productId)) n.delete(productId);
        else n.add(productId);
        return n;
      };
      setIds(flip);
      const res = await fetch("/api/account/wishlist", {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      }).catch(() => null);
      if (!res?.ok) setIds(flip); // roll back
      if (res?.status === 401) router.push(`/login?next=${encodeURIComponent(path)}`);
      router.refresh();
    },
    [ids, signedIn, router, path],
  );

  const value = useMemo(() => ({ signedIn, has: (id: string) => ids.has(id), count: ids.size, toggle }), [ids, signedIn, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist(): WishlistState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWishlist outside WishlistProvider");
  return c;
}

export function WishlistButton({ productId, name, variant = "icon", className }: { productId: string; name: string; variant?: "icon" | "full"; className?: string }) {
  const w = useWishlist();
  const saved = w.has(productId);
  const label = saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`;
  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={() => w.toggle(productId)}
        aria-pressed={saved}
        className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors", saved ? "border-primary bg-primary/5 text-primary" : "border-input hover:border-primary", className)}
      >
        <Heart className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" /> {saved ? "Saved to wishlist" : "Save to wishlist"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void w.toggle(productId);
      }}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-dropdown transition-colors hover:text-primary", saved ? "text-primary" : "text-foreground", className)}
    >
      <Heart className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
    </button>
  );
}

export function WishlistHeaderLink() {
  const w = useWishlist();
  return (
    <a
      href={w.signedIn ? "/account/wishlist" : "/login?next=%2Faccount%2Fwishlist"}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted"
      aria-label={`Wishlist${w.count ? ` (${w.count} items)` : ""}`}
    >
      <Heart className="h-5 w-5" aria-hidden="true" />
      {w.count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
          {w.count > 99 ? "99+" : w.count}
        </span>
      )}
    </a>
  );
}
