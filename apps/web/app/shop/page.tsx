import { searchCatalog, type ShopResult } from "@ecom/services";
import { formatNumberIN } from "@ecom/ui/format";
import { ChevronLeft, ChevronRight, SearchX, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ZodError } from "zod";
import { ProductCard } from "@/components/product-card";
import { navCategories } from "@/lib/catalog";
import { shopHref } from "@/lib/utils";
import { FiltersPanel, MobileFilters, SortSelect } from "./filters";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const flat = (sp: SP) => Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;

async function load(params: Record<string, string | undefined>): Promise<ShopResult> {
  try {
    return await searchCatalog(params);
  } catch (err) {
    // Malformed query string (hand-edited URL): keep only the safe basics.
    if (err instanceof ZodError) return searchCatalog({ q: params.q?.slice(0, 100), category: params.category });
    throw err;
  }
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const p = flat(await searchParams);
  if (p.q) return { title: `Search: ${p.q.slice(0, 60)}`, robots: { index: false } };
  if (p.category) {
    const cats = await navCategories();
    const all = cats.flatMap((c) => [c, ...c.children]);
    const c = all.find((x) => x.slug === p.category);
    if (c) return { title: c.name, alternates: { canonical: `/shop?category=${c.slug}` } };
  }
  return { title: "Shop all products", alternates: { canonical: "/shop" } };
}

const TAG_TITLE: Record<string, string> = { new: "New arrivals", bestseller: "Best sellers", custom: "Customisable products" };

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const params = flat(await searchParams);
  const [res, categories] = await Promise.all([load(params), navCategories()]);
  const q = res.query;

  const title = q.q ? `Results for “${q.q}”` : (res.category?.name ?? (q.tag ? TAG_TITLE[q.tag] : "All products"));

  // Active filter chips (each removes itself).
  const chips: { label: string; href: string }[] = [];
  const without = (key: string, value?: string) => {
    if (!value) return shopHref(params, { [key]: undefined, page: undefined });
    const rest = (params[key] ?? "").split(",").filter((v) => v && v !== value).join(",");
    return shopHref(params, { [key]: rest || undefined, page: undefined });
  };
  for (const b of q.brand) chips.push({ label: res.facets.brands.find((x) => x.slug === b)?.name ?? b, href: without("brand", b) });
  for (const c of q.color) chips.push({ label: c, href: without("color", c) });
  for (const s of q.size) chips.push({ label: `Size ${s}`, href: without("size", s) });
  for (const m of q.material) chips.push({ label: m, href: without("material", m) });
  if (q.minPrice !== undefined || q.maxPrice !== undefined)
    chips.push({ label: `₹${q.minPrice ?? 0}–${q.maxPrice ?? "∞"}`, href: shopHref(params, { minPrice: undefined, maxPrice: undefined, page: undefined }) });
  if (q.rating) chips.push({ label: `${q.rating}★ & above`, href: without("rating") });
  if (q.inStock) chips.push({ label: "In stock", href: without("inStock") });
  if (q.tag && (q.q || q.category)) chips.push({ label: TAG_TITLE[q.tag]!, href: without("tag") });

  return (
    <div className="container-store py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href="/shop" className="hover:text-foreground">
          Shop
        </Link>
        {res.category && (
          <>
            <span aria-hidden="true"> / </span>
            <span className="text-foreground">{res.category.name}</span>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {formatNumberIN(res.total)} product{res.total === 1 ? "" : "s"}
          </p>
          {res.category?.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{res.category.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Suspense>
            <MobileFilters facets={res.facets} categories={categories} activeCount={chips.length} />
            <SortSelect />
          </Suspense>
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <li key={c.label + c.href}>
              <Link href={c.href} className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium hover:border-primary">
                {c.label} <X className="h-3 w-3" aria-label="remove" />
              </Link>
            </li>
          ))}
          <li>
            <Link href={q.q ? `/shop?q=${encodeURIComponent(q.q)}` : q.category ? `/shop?category=${q.category}` : "/shop"} className="inline-flex px-2 py-1 text-xs font-semibold text-link hover:underline">
              Clear filters
            </Link>
          </li>
        </ul>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <Suspense>
            <FiltersPanel facets={res.facets} categories={categories} />
          </Suspense>
        </aside>

        <section aria-label="Products">
          {res.items.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-3 font-display text-lg font-semibold">No products found</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {q.q ? "Check the spelling or try a broader term." : "Try removing a filter or browsing another category."}
              </p>
              <Link href="/shop" className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
                Browse all products
              </Link>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {res.items.map((p, i) => (
                <li key={p.id}>
                  <ProductCard product={p} priority={i < 4} />
                </li>
              ))}
            </ul>
          )}

          {res.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
              {res.page > 1 ? (
                <Link href={shopHref(params, { page: String(res.page - 1) })} className="inline-flex h-10 items-center gap-1 rounded-lg border border-input px-3 text-sm hover:border-primary" rel="prev">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Link>
              ) : null}
              <span className="px-3 text-sm text-muted-foreground">
                Page {res.page} of {res.totalPages}
              </span>
              {res.page < res.totalPages ? (
                <Link href={shopHref(params, { page: String(res.page + 1) })} className="inline-flex h-10 items-center gap-1 rounded-lg border border-input px-3 text-sm hover:border-primary" rel="next">
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              ) : null}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
