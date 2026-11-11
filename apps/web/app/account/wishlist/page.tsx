import { listWishlist } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { WishlistButton } from "@/components/wishlist";
import { requireCustomer } from "@/lib/customer";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const c = await requireCustomer("/account/wishlist");
  const items = await listWishlist({ userId: c.userId });
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
        <Heart className="h-9 w-9 text-primary" aria-hidden="true" />
        <h2 className="mt-3 font-display text-lg font-semibold">Your wishlist is empty</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any product to save it here.</p>
        <Link href="/shop" className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Browse products</Link>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {items.map((p) => (
        <li key={p.productId} className="relative overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative aspect-[4/5] bg-muted">
            <ProductImage src={p.imageUrl} alt={p.name} sizes="(min-width: 768px) 25vw, 50vw" />
            <WishlistButton productId={p.productId} name={p.name} className="absolute right-2 top-2 z-10" />
            {!p.available && <div className="absolute inset-x-0 bottom-0 bg-white/90 py-1.5 text-center text-xs font-semibold text-muted-foreground">No longer available</div>}
          </div>
          <div className="space-y-1 p-3">
            {p.available ? (
              <Link href={`/products/${p.slug}`} className="line-clamp-2 text-sm font-medium after:absolute after:inset-0 after:content-['']">{p.name}</Link>
            ) : (
              <p className="line-clamp-2 text-sm font-medium text-muted-foreground">{p.name}</p>
            )}
            {p.price !== null && <p className="font-display text-sm font-semibold">{formatPaise(p.price)}</p>}
            {p.available && !p.inStock && <p className="text-xs text-destructive">Out of stock</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
