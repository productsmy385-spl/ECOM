"use client";

import type { ProductDetail } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { Palette, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Price } from "@/components/price";
import { ProductImage } from "@/components/product-image";
import { RatingPill } from "@/components/rating";
import { cn } from "@/lib/utils";

type Variant = ProductDetail["variants"][number];

const AVAIL = {
  in_stock: { label: "In stock", cls: "text-success" },
  low_stock: { label: "Hurry, only a few left", cls: "text-warning" },
  out_of_stock: { label: "Currently out of stock", cls: "text-destructive" },
} as const;

function deliveryWindow(days: [number, number]) {
  const fmt = (d: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };
  return `${fmt(days[0])} – ${fmt(days[1])}`;
}

export function ProductView({ product, initialSku, customizable }: { product: ProductDetail; initialSku?: string; customizable: boolean }) {
  const start = product.variants.find((v) => v.sku === initialSku) ?? product.variants.find((v) => v.isDefault) ?? product.variants[0]!;
  const [variant, setVariant] = useState<Variant>(start);
  const [imageIndex, setImageIndex] = useState(0);

  const colors = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const v of product.variants) if (v.color) m.set(v.color, v.colorHex);
    return [...m];
  }, [product.variants]);
  const sizes = useMemo(() => [...new Set(product.variants.map((v) => v.size).filter(Boolean))] as string[], [product.variants]);

  // Images for the chosen variant first; product-wide images always included.
  const images = useMemo(() => {
    const own = product.images.filter((i) => i.variantId === variant.id);
    const shared = product.images.filter((i) => !i.variantId);
    return [...own, ...shared];
  }, [product.images, variant.id]);
  const current = images[Math.min(imageIndex, Math.max(0, images.length - 1))];

  function choose(next: Partial<Pick<Variant, "color" | "size">>) {
    const color = next.color ?? variant.color;
    const size = next.size ?? variant.size;
    const exact = product.variants.find((v) => v.color === color && v.size === size);
    const partial = product.variants.find((v) => (next.color ? v.color === color : v.size === size));
    const picked = exact ?? partial ?? variant;
    setVariant(picked);
    setImageIndex(0);
    // Keep the choice shareable without a navigation.
    const url = new URL(window.location.href);
    url.searchParams.set("v", picked.sku);
    window.history.replaceState(null, "", url);
  }

  const availableFor = (pred: (v: Variant) => boolean) => product.variants.some((v) => pred(v) && v.availability !== "out_of_stock");

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {/* Gallery */}
      <div className="lg:sticky lg:top-40 lg:self-start">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
          <ProductImage src={current?.url ?? null} alt={current?.alt ?? product.name} hint={product.category.name} priority sizes="(min-width: 1024px) 50vw, 100vw" />
        </div>
        {images.length > 1 && (
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
            {images.map((img, i) => (
              <li key={img.url} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setImageIndex(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={i === imageIndex}
                  className={cn("relative h-16 w-16 overflow-hidden rounded-lg border-2 sm:h-20 sm:w-20", i === imageIndex ? "border-primary" : "border-transparent")}
                >
                  <ProductImage src={img.url} alt="" sizes="80px" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Buy box */}
      <div className="flex flex-col gap-5">
        <div>
          {product.brand && (
            <Link href={`/shop?brand=${product.brand.slug}`} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-primary">
              {product.brand.name}
            </Link>
          )}
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight sm:text-3xl">{product.name}</h1>
          {product.shortDescription && <p className="mt-2 text-muted-foreground">{product.shortDescription}</p>}
          <RatingPill avg={product.ratingAvg} count={product.ratingCount} className="mt-3" />
        </div>

        <div className="border-y border-border py-4">
          <Price price={variant.price} compareAt={variant.compareAtPrice} size="lg" />
          <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>
          <p className={cn("mt-3 text-sm font-semibold", AVAIL[variant.availability].cls)} aria-live="polite">
            {AVAIL[variant.availability].label}
          </p>
        </div>

        {colors.length > 0 && (
          <fieldset>
            <legend className="text-sm font-semibold">
              Colour: <span className="font-normal text-muted-foreground">{variant.color ?? "—"}</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map(([name, hex]) => {
                const selected = variant.color === name;
                const inStock = availableFor((v) => v.color === name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => choose({ color: name })}
                    aria-pressed={selected}
                    aria-label={`${name}${inStock ? "" : " (out of stock)"}`}
                    title={name}
                    className={cn(
                      "relative h-10 w-10 rounded-full border-2 p-0.5 transition-colors",
                      selected ? "border-primary" : "border-border hover:border-foreground/40",
                      !inStock && "opacity-40",
                    )}
                  >
                    <span className="block h-full w-full rounded-full border border-black/10" style={{ backgroundColor: hex ?? "#e5e5e5" }} />
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {sizes.length > 0 && (
          <fieldset>
            <legend className="text-sm font-semibold">Size</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {sizes.map((s) => {
                const selected = variant.size === s;
                const inStock = availableFor((v) => v.size === s && (!variant.color || v.color === variant.color));
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => choose({ size: s })}
                    aria-pressed={selected}
                    className={cn(
                      "h-10 min-w-12 rounded-lg border px-3 text-sm font-medium transition-colors",
                      selected ? "border-primary bg-primary/5 text-primary" : "border-input hover:border-foreground/40",
                      !inStock && "text-muted-foreground line-through",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {!colors.length && !sizes.length && product.variants.length > 1 && (
          <fieldset>
            <legend className="text-sm font-semibold">Option</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariant(v)}
                  aria-pressed={variant.id === v.id}
                  className={cn("h-10 rounded-lg border px-3 text-sm", variant.id === v.id ? "border-primary bg-primary/5 text-primary" : "border-input")}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {variant.material && (
          <p className="text-sm">
            <span className="font-semibold">Material:</span> {variant.material}
          </p>
        )}

        {customizable && (
          <div className="flex flex-col gap-3 rounded-xl bg-blush-50 p-4 sm:flex-row sm:items-center">
            <Palette className="hidden h-6 w-6 shrink-0 text-primary sm:block" aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Make it yours</p>
              <p className="text-muted-foreground">Choose colours, add text or your own artwork, and see it live.</p>
            </div>
            <Link
              href={`/customize/${product.id}?v=${encodeURIComponent(variant.sku)}`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              <Palette className="h-4 w-4" aria-hidden="true" /> Customise this product
            </Link>
          </div>
        )}

        <div className="flex gap-3 rounded-xl border border-border p-4">
          <Truck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold">Estimated delivery: {deliveryWindow(product.delivery.standardDays)}</p>
            <p className="text-muted-foreground">
              {variant.price >= product.delivery.freeShippingAbove
                ? "Free standard shipping on this item."
                : `Free shipping on orders above ${formatPaise(product.delivery.freeShippingAbove, { whole: true })}.`}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>
      </div>
    </div>
  );
}
