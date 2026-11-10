import { categories, db } from "@ecom/db";
import { brand } from "@ecom/ui/brand";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Phase 1 foundation page: proves the storefront renders brand tokens and reads
 * live data. Replaced by the full Bookly-inspired homepage in Phase 3.
 */
export default async function HomePage() {
  const cats = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug, isCustomizable: categories.isCustomizable })
    .from(categories)
    .where(and(eq(categories.isActive, true), isNull(categories.deletedAt)))
    .orderBy(asc(categories.sortOrder));

  return (
    <main>
      <div className="bg-ink py-2 text-center text-xs font-medium text-white">
        Opening soon — our full store is being built.
      </div>
      <section className="bg-blush-50">
        <div className="container-store py-16 sm:py-24">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-primary">{brand.name}</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            Beauty and eyewear, <span className="text-primary">designed by you.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Cosmetics, frames, sunglasses and accessories — with personalisation built in.
          </p>
        </div>
      </section>
      <section className="container-store py-12" aria-labelledby="cats">
        <h2 id="cats" className="font-display text-xl font-semibold">
          Categories
        </h2>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cats.map((c) => (
            <li
              key={c.id}
              className="flex min-h-20 min-w-0 flex-col items-start justify-center gap-2 rounded-xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-display text-sm font-semibold">{c.name}</span>
              {c.isCustomizable && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-accent-foreground">
                  <Sparkles className="h-3 w-3" aria-hidden="true" /> Custom
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
