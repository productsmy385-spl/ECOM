import type { ProductCard as Card } from "@ecom/services";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "./product-card";

/** Section with a horizontally scrolling row on phones and a grid on desktop. */
export function ProductRail({
  title,
  subtitle,
  href,
  products,
  id,
}: {
  title: string;
  subtitle?: string;
  href: string;
  products: Card[];
  id: string;
}) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id} className="container-store py-8 sm:py-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id={id} className="font-display text-xl font-semibold sm:text-2xl">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-link hover:underline">
          View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {products.slice(0, 10).map((p, i) => (
          <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
            <ProductCard product={p} priority={i < 2} />
          </li>
        ))}
      </ul>
    </section>
  );
}
