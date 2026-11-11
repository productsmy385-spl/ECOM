import type { ProductCard as Card } from "@ecom/services";
import { discountPercent, formatPaise } from "@ecom/ui/format";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";
import { QuickAdd } from "./quick-add";
import { QuickViewButton } from "./quick-view";
import { Stars } from "./rating";
import { WishlistButton } from "./wishlist";

/**
 * Bordered product card: discount/new pill top-left, image, name, brand and
 * stars, price in brand colour. Actions (add to bag, wishlist, quick view)
 * rise into view on hover/focus, and are always visible on touch screens.
 */
export function ProductCard({ product, priority, className }: { product: Card; priority?: boolean; className?: string }) {
  const off = discountPercent(product.price, product.compareAtPrice);
  return (
    <article className={cn("group relative flex h-full flex-col rounded-2xl border border-border bg-card p-2.5 transition-shadow sm:p-4 duration-300 hover:shadow-product", className)}>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted shadow-sm">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          hint={product.categoryName}
          priority={priority}
          sizes="(min-width: 1400px) 18vw, (min-width: 1000px) 23vw, (min-width: 560px) 45vw, 90vw"
          className="transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
          {off > 0 && <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{off}% off</span>}
          {product.isNew && <span className="rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-white">New</span>}
        </div>
        {!product.inStock && (
          <div className="absolute inset-x-0 bottom-0 bg-white/90 py-1.5 text-center text-xs font-semibold text-muted-foreground">Out of stock</div>
        )}
        <div className="card-actions absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1.5 sm:bottom-3 sm:gap-2 [&>*]:max-sm:h-9 [&>*]:max-sm:w-9">
          <QuickAdd variantId={product.quickAddVariantId} slug={product.slug} name={product.name} customizable={product.isCustomizable} inStock={product.inStock} />
          <WishlistButton productId={product.id} name={product.name} className="h-11 w-11 bg-ink text-white shadow-none hover:bg-primary hover:text-white" />
          <QuickViewButton slug={product.slug} name={product.name} round />
        </div>
      </div>
      <h3 className="mt-4 line-clamp-2 text-[0.95rem] font-bold leading-snug">
        {/* Stretched link: the whole card opens the product; the action buttons sit above it. */}
        <Link href={`/products/${product.slug}`} className="transition-colors duration-300 after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none">
          {product.name}
        </Link>
      </h3>
      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="truncate text-xs text-muted-foreground">{product.brandName ?? product.categoryName}</p>
        {product.ratingCount > 0 && <Stars value={product.ratingAvg} className="[&_svg]:h-3.5 [&_svg]:w-3.5" />}
        {product.isCustomizable && <span className="rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold">Customisable</span>}
      </div>
      <p className="mt-auto flex items-baseline gap-2 pt-2">
        <span className="text-lg font-bold text-primary">{formatPaise(product.price)}</span>
        {off > 0 && product.compareAtPrice && (
          <del className="text-sm text-muted-foreground">
            <span className="sr-only">MRP </span>
            {formatPaise(product.compareAtPrice)}
          </del>
        )}
      </p>
    </article>
  );
}
