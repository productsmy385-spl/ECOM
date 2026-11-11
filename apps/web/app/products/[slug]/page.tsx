import { getCheckoutSettings, getCustomizerData, myReviewState, relatedProducts } from "@ecom/services";
import { brand } from "@ecom/ui/brand";
import { formatPaise } from "@ecom/ui/format";
import { RecentlyViewed, TrackView } from "@/components/recently-viewed";
import { getCustomer } from "@/lib/customer";
import { DeliveryCheck } from "./delivery-check";
import { ReviewForm } from "./review-form";
import { BadgeCheck, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductRail } from "@/components/product-rail";
import { Stars } from "@/components/rating";
import { productBySlug } from "@/lib/catalog";
import { ik } from "@/lib/utils";
import { ProductView } from "./product-view";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
const SLUG = /^[a-z0-9-]{1,160}$/;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return { title: "Product not found" };
  const p = await productBySlug(slug);
  if (!p) return { title: "Product not found" };
  const description = p.seoDescription ?? p.shortDescription ?? `${p.name} from ${brand.name}.`;
  const image = p.images[0]?.url;
  return {
    title: p.seoTitle ?? p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.name, description, images: image ? [{ url: ik(image, 1200) }] : undefined },
  };
}

export default async function ProductPage({ params, searchParams }: { params: Params; searchParams: Promise<{ v?: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const [product, { v }] = await Promise.all([productBySlug(slug), searchParams]);
  if (!product) notFound();
  const customer = await getCustomer();
  const [related, customizer, reviewState, shipping] = await Promise.all([
    relatedProducts(product.id, product.category.slug),
    // Only offer "Customise" when the customiser really exists (options configured).
    product.isCustomizable ? getCustomizerData(product.id) : Promise.resolve(null),
    customer ? myReviewState({ userId: customer.userId }, product.id) : Promise.resolve(null),
    getCheckoutSettings(),
  ]);
  const viewed = { id: product.id, slug: product.slug, name: product.name, price: Math.min(...product.variants.map((x) => x.price)), imageUrl: product.images[0]?.url ?? null };

  const prices = product.variants.map((x) => x.price);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description ?? undefined,
    sku: product.variants[0]?.sku,
    image: product.images.map((i) => ik(i.url, 1200)),
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    aggregateRating:
      product.ratingCount > 0 ? { "@type": "AggregateRating", ratingValue: product.ratingAvg.toFixed(1), reviewCount: product.ratingCount } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: (Math.min(...prices) / 100).toFixed(2),
      highPrice: (Math.max(...prices) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: product.variants.some((x) => x.availability !== "out_of_stock") ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  const totalReviews = Object.values(product.ratingBreakdown).reduce((a, b) => a + b, 0);
  const specGroups = [...new Set(product.specs.map((s) => s.group ?? ""))];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-store py-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-5 truncate text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/shop?category=${product.category.slug}`} className="hover:text-foreground">
            {product.category.name}
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        <ProductView product={product} initialSku={v} customizable={customizer !== null} requiresDesign={!!customizer?.options.some((o) => o.isRequired)} />
        <TrackView product={viewed} />
        <div className="max-w-xl">
          <DeliveryCheck
            standardDays={shipping.standardDays}
            expressDays={shipping.expressDays}
            productionDays={product.isCustomizable ? 2 : 0}
            freeAbove={formatPaise(shipping.freeShippingThreshold, { whole: true })}
          />
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-10">
            {product.description && (
              <section aria-labelledby="desc">
                <h2 id="desc" className="font-display text-xl font-semibold">
                  Description
                </h2>
                <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.description}</div>
              </section>
            )}

            {product.specs.length > 0 && (
              <section aria-labelledby="specs">
                <h2 id="specs" className="font-display text-xl font-semibold">
                  Specifications
                </h2>
                {specGroups.map((g) => (
                  <div key={g} className="mt-4">
                    {g && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{g}</h3>}
                    <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border text-sm">
                      {product.specs
                        .filter((s) => (s.group ?? "") === g)
                        .map((s) => (
                          <div key={s.name} className="grid grid-cols-[40%_1fr] gap-4 px-4 py-2.5">
                            <dt className="text-muted-foreground">{s.name}</dt>
                            <dd>{s.value}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                ))}
              </section>
            )}
          </div>

          <section aria-labelledby="reviews-h">
            <h2 id="reviews-h" className="font-display text-xl font-semibold">
              Ratings &amp; reviews
            </h2>
            {totalReviews === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                <MessageSquareText className="h-5 w-5 shrink-0" aria-hidden="true" />
                No reviews yet. Customers who buy this product can review it after delivery.
              </div>
            ) : (
              <>
                <div className="mt-4 flex items-center gap-6 rounded-xl border border-border p-5">
                  <div className="text-center">
                    <p className="font-display text-4xl font-bold">{product.ratingAvg.toFixed(1)}</p>
                    <Stars value={product.ratingAvg} />
                    <p className="mt-1 text-xs text-muted-foreground">{product.ratingCount} ratings</p>
                  </div>
                  <ul className="flex-1 space-y-1">
                    {([5, 4, 3, 2, 1] as const).map((r) => (
                      <li key={r} className="flex items-center gap-2 text-xs">
                        <span className="w-3">{r}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-success" style={{ width: `${(product.ratingBreakdown[r] / totalReviews) * 100}%` }} />
                        </span>
                        <span className="w-8 text-right text-muted-foreground">{product.ratingBreakdown[r]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <ul className="mt-4 space-y-4">
                  {product.reviews.map((r) => (
                    <li key={r.id} className="border-b border-border pb-4">
                      <div className="flex items-center gap-2">
                        <Stars value={r.rating} />
                        {r.title && <p className="text-sm font-semibold">{r.title}</p>}
                      </div>
                      {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        {r.author} · {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {r.verified && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-success">
                            <BadgeCheck className="h-3.5 w-3.5" /> Verified purchase
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <ReviewForm productId={product.id} signedIn={!!customer} initial={reviewState} loginHref={`/login?next=${encodeURIComponent(`/products/${product.slug}#write-review`)}`} />
          </section>
        </div>
      </div>

      <ProductRail id="related" title="You may also like" href={`/shop?category=${product.category.slug}`} products={related} />
      <RecentlyViewed excludeId={product.id} />
    </>
  );
}
