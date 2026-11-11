"use client";

import { formatPaise } from "@ecom/ui/format";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "./product-image";

const KEY = "adira:recently-viewed";
const MAX = 12;

export type ViewedProduct = { id: string; slug: string; name: string; price: number; imageUrl: string | null };

function read(): ViewedProduct[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as ViewedProduct[];
    return Array.isArray(v) ? v.filter((p) => p && typeof p.slug === "string" && /^[a-z0-9-]+$/.test(p.slug)) : [];
  } catch {
    return [];
  }
}

/** Remembers this product in the shopper's browser (no server storage). */
export function TrackView({ product }: { product: ViewedProduct }) {
  useEffect(() => {
    try {
      const list = [product, ...read().filter((p) => p.id !== product.id)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {}
  }, [product]);
  return null;
}

/** "Recently viewed" strip, excluding the current product. Renders nothing until there's history. */
export function RecentlyViewed({ excludeId, className }: { excludeId?: string; className?: string }) {
  const [items, setItems] = useState<ViewedProduct[]>([]);
  useEffect(() => {
    const id = requestAnimationFrame(() => setItems(read().filter((p) => p.id !== excludeId).slice(0, 6)));
    return () => cancelAnimationFrame(id);
  }, [excludeId]);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-h" className={className ?? "container-store py-12"}>
      <div className="mb-5 flex items-center justify-between">
        <h2 id="recent-h" className="font-display text-xl font-semibold sm:text-2xl">
          Recently viewed
        </h2>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(KEY);
            } catch {}
            setItems([]);
          }}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((p) => (
          <li key={p.id}>
            <Link href={`/products/${p.slug}`} className="group block">
              <span className="relative block aspect-square overflow-hidden rounded-xl bg-muted">
                <ProductImage src={p.imageUrl} alt="" sizes="(min-width: 1024px) 16vw, 45vw" />
              </span>
              <span className="mt-2 line-clamp-2 block text-sm font-medium group-hover:text-primary">{p.name}</span>
              <span className="text-sm font-bold text-primary">{formatPaise(p.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
