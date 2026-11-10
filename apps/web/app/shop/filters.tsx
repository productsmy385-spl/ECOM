"use client";

import type { NavCategory, ShopFacets } from "@ecom/services";
import * as Dialog from "@radix-ui/react-dialog";
import { SlidersHorizontal, Star, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "", label: "Recommended" },
  { value: "popular", label: "Popularity" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Highest rated" },
];

function useShopParams() {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const [pending, start] = useTransition();
  // Optimistic: controls reflect a change immediately while the server renders results.
  const [optimistic, setOptimistic] = useOptimistic(urlParams.toString());
  const params = new URLSearchParams(optimistic);
  const set = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(optimistic);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // any filter change starts from page 1
    start(() => {
      setOptimistic(next.toString());
      router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    });
  };
  const list = (k: string) => (params.get(k) ?? "").split(",").filter(Boolean);
  const toggle = (k: string, v: string) => {
    const cur = list(k);
    set({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") || undefined });
  };
  return { params, set, list, toggle, pending };
}

export function SortSelect() {
  const { params, set } = useShopParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted-foreground sm:inline">Sort by</span>
      <select
        value={params.get("sort") ?? ""}
        onChange={(e) => set({ sort: e.target.value || undefined })}
        className="h-10 rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring"
        aria-label="Sort products"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-border py-4 first:pt-0">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Check({ checked, onChange, label, swatch }: { checked: boolean; onChange: () => void; label: string; swatch?: string | null }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md py-0.5 text-sm hover:text-primary">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-primary" />
      {swatch !== undefined && (
        <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: swatch ?? "transparent" }} aria-hidden="true" />
      )}
      <span className="truncate">{label}</span>
    </label>
  );
}

export function FiltersPanel({ facets, categories }: { facets: ShopFacets; categories: NavCategory[] }) {
  const { params, set, list, toggle, pending } = useShopParams();
  const [min, setMin] = useState(params.get("minPrice") ?? "");
  const [max, setMax] = useState(params.get("maxPrice") ?? "");
  const currentCat = params.get("category");

  return (
    <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <Group title="Category">
        <button type="button" onClick={() => set({ category: undefined })} className={cn("block text-left text-sm hover:text-primary", !currentCat && "font-semibold text-primary")}>
          All products
        </button>
        {categories.map((c) => (
          <div key={c.id}>
            <button type="button" onClick={() => set({ category: c.slug })} className={cn("block text-left text-sm hover:text-primary", currentCat === c.slug && "font-semibold text-primary")}>
              {c.name}
            </button>
            {c.children.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => set({ category: ch.slug })}
                className={cn("block pl-3 text-left text-sm text-muted-foreground hover:text-primary", currentCat === ch.slug && "font-semibold text-primary")}
              >
                {ch.name}
              </button>
            ))}
          </div>
        ))}
      </Group>

      <Group title="Price (₹)">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            set({ minPrice: min || undefined, maxPrice: max || undefined });
          }}
        >
          <input aria-label="Minimum price" inputMode="numeric" placeholder={facets.priceRange ? String(Math.floor(facets.priceRange.min / 100)) : "Min"} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className="h-9 w-full min-w-0 rounded-lg border border-input px-2 text-sm" />
          <span className="text-muted-foreground">–</span>
          <input aria-label="Maximum price" inputMode="numeric" placeholder={facets.priceRange ? String(Math.ceil(facets.priceRange.max / 100)) : "Max"} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} className="h-9 w-full min-w-0 rounded-lg border border-input px-2 text-sm" />
          <button type="submit" className="h-9 shrink-0 rounded-lg bg-foreground px-3 text-xs font-semibold text-background">
            Go
          </button>
        </form>
      </Group>

      {facets.brands.length > 0 && (
        <Group title="Brand">
          {facets.brands.map((b) => (
            <Check key={b.slug} label={b.name} checked={list("brand").includes(b.slug)} onChange={() => toggle("brand", b.slug)} />
          ))}
        </Group>
      )}
      {facets.colors.length > 0 && (
        <Group title="Colour">
          {facets.colors.map((c) => (
            <Check key={c.name} label={c.name} swatch={c.hex} checked={list("color").map((x) => x.toLowerCase()).includes(c.name.toLowerCase())} onChange={() => toggle("color", c.name)} />
          ))}
        </Group>
      )}
      {facets.sizes.length > 0 && (
        <Group title="Size">
          {facets.sizes.map((s) => (
            <Check key={s} label={s} checked={list("size").includes(s)} onChange={() => toggle("size", s)} />
          ))}
        </Group>
      )}
      {facets.materials.length > 0 && (
        <Group title="Material">
          {facets.materials.map((m) => (
            <Check key={m} label={m} checked={list("material").includes(m)} onChange={() => toggle("material", m)} />
          ))}
        </Group>
      )}

      <Group title="Customer rating">
        {[4, 3].map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-2.5 text-sm hover:text-primary">
            <input type="radio" name="rating" checked={params.get("rating") === String(r)} onChange={() => set({ rating: String(r) })} className="h-4 w-4 accent-primary" />
            <span className="inline-flex items-center gap-1">
              {r} <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> &amp; above
            </span>
          </label>
        ))}
        {params.get("rating") && (
          <button type="button" onClick={() => set({ rating: undefined })} className="text-xs text-link hover:underline">
            Clear rating
          </button>
        )}
      </Group>

      <Group title="More filters">
        <Check label="In stock only" checked={params.get("inStock") === "1"} onChange={() => set({ inStock: params.get("inStock") ? undefined : "1" })} />
        <Check label="New arrivals" checked={params.get("tag") === "new"} onChange={() => set({ tag: params.get("tag") === "new" ? undefined : "new" })} />
        <Check label="Best sellers" checked={params.get("tag") === "bestseller"} onChange={() => set({ tag: params.get("tag") === "bestseller" ? undefined : "bestseller" })} />
        <Check label="Customisable" checked={params.get("tag") === "custom"} onChange={() => set({ tag: params.get("tag") === "custom" ? undefined : "custom" })} />
      </Group>
    </div>
  );
}

/** Mobile: filters in a bottom sheet. */
export function MobileFilters({ facets, categories, activeCount }: { facets: ShopFacets; categories: NavCategory[]; activeCount: number }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-white px-3 text-sm font-medium lg:hidden">
        <SlidersHorizontal className="h-4 w-4" /> Filters
        {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">{activeCount}</span>}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-card shadow-modal focus:outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="font-display text-base font-semibold">Filters</Dialog.Title>
            <Dialog.Close className="rounded-lg p-2 hover:bg-muted" aria-label="Close filters">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Narrow down products</Dialog.Description>
          <div className="overflow-y-auto px-4 py-4">
            <FiltersPanel facets={facets} categories={categories} />
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <Link href="/shop" className="flex h-11 flex-1 items-center justify-center rounded-lg border border-input text-sm font-semibold">
              Clear all
            </Link>
            <Dialog.Close className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">Show results</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
