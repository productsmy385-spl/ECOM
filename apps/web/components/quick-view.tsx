"use client";

import type { ProductDetail } from "@ecom/services";
import * as Dialog from "@radix-ui/react-dialog";
import { Eye, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Price } from "./price";
import { ProductImage } from "./product-image";
import { RatingPill } from "./rating";

const AVAILABILITY = {
  in_stock: { label: "In stock", cls: "text-success" },
  low_stock: { label: "Only a few left", cls: "text-warning" },
  out_of_stock: { label: "Out of stock", cls: "text-destructive" },
} as const;

/** Fetches the public product detail on demand and shows a compact preview. */
export function QuickViewButton({ slug, name }: { slug: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (data) return;
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(res.status === 404 ? "This product is no longer available." : "Couldn't load this product.");
      setData((await res.json()) as ProductDetail);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const v = data?.variants.find((x) => x.isDefault) ?? data?.variants[0];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <Dialog.Trigger
        className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-dropdown opacity-100 transition-opacity hover:bg-white focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        aria-label={`Quick view: ${name}`}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Quick view
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-card shadow-modal focus:outline-none data-[state=open]:animate-fade-in">
          <Dialog.Close className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 shadow hover:bg-white" aria-label="Close">
            <X className="h-4 w-4" />
          </Dialog.Close>
          {!data && !error && (
            <div className="flex h-72 items-center justify-center" role="status">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="sr-only">Loading</span>
            </div>
          )}
          {error && (
            <p role="alert" className="p-8 text-sm text-destructive">
              {error}
            </p>
          )}
          {data && v && (
            <div className="grid sm:grid-cols-2">
              <div className="relative aspect-square bg-muted sm:aspect-auto sm:min-h-[420px]">
                <ProductImage src={data.images[0]?.url ?? null} alt={data.name} hint={data.category.name} sizes="(min-width: 640px) 380px, 100vw" />
              </div>
              <div className="flex flex-col gap-3 p-6">
                {data.brand && <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{data.brand.name}</p>}
                <Dialog.Title className="font-display text-xl font-semibold leading-snug">{data.name}</Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">{data.shortDescription ?? data.category.name}</Dialog.Description>
                <RatingPill avg={data.ratingAvg} count={data.ratingCount} />
                <Price price={v.price} compareAt={v.compareAtPrice} size="md" />
                <p className={`text-sm font-medium ${AVAILABILITY[v.availability].cls}`}>{AVAILABILITY[v.availability].label}</p>
                {data.variants.length > 1 && <p className="text-sm text-muted-foreground">{data.variants.length} options available</p>}
                <Link
                  href={`/products/${data.slug}`}
                  className="mt-auto inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
                >
                  View full details
                </Link>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
