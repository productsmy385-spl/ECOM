import type { ProductCard as Card } from "@ecom/services";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Carousel } from "./carousel";
import { ProductCard } from "./product-card";
import { Reveal } from "./reveal";

/** Section title with a "View all" pill, then a sliding row of product cards. */
export function ProductRail({
  title,
  subtitle,
  href,
  products,
  id,
  className,
}: {
  title: string;
  subtitle?: string;
  href: string;
  products: Card[];
  id: string;
  className?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id} className={cn("py-14 sm:py-20", className)}>
      <Reveal className="container-store">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id={id} className="font-display text-2xl font-semibold capitalize tracking-wide sm:text-3xl">
              {title}
            </h2>
            {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
          </div>
          <Link href={href} className="btn-pill self-start sm:self-auto">
            View all
          </Link>
        </div>
        <Carousel label={title}>
          {products.slice(0, 10).map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </Carousel>
      </Reveal>
    </section>
  );
}
