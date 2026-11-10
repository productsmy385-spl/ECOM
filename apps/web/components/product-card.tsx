import type { ProductCard as Card } from "@ecom/services";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Price } from "./price";
import { ProductImage } from "./product-image";
import { QuickViewButton } from "./quick-view";
import { RatingPill } from "./rating";

export function ProductCard({ product, priority, className }: { product: Card; priority?: boolean; className?: string }) {
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow duration-200 hover:shadow-product",
        className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          hint={product.categoryName}
          priority={priority}
          sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.isNew && <span className="rounded-md bg-ink px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-white">New</span>}
          {product.isCustomizable && (
            <span className="rounded-md bg-highlight px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-highlight-foreground">Customisable</span>
          )}
        </div>
        {!product.inStock && (
          <div className="absolute inset-x-0 bottom-0 bg-white/90 py-1.5 text-center text-xs font-semibold text-muted-foreground">Out of stock</div>
        )}
        <QuickViewButton slug={product.slug} name={product.name} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        {product.brandName && <p className="truncate text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{product.brandName}</p>}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
          {/* Stretched link: the whole card is clickable; quick view sits above it. */}
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>
        <RatingPill avg={product.ratingAvg} count={product.ratingCount} />
        <Price price={product.price} compareAt={product.compareAtPrice} size="sm" className="mt-auto pt-1" />
        {product.colors.length > 1 && (
          <div className="flex gap-1" aria-label={`${product.colors.length} colours`}>
            {product.colors.map((c) => (
              <span key={c} className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: c }} aria-hidden="true" />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
