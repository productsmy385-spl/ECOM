import { formatPaise } from "@ecom/ui/format";
import { ArrowRight, Glasses, Palette, Quote, Sparkles, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProductRail } from "@/components/product-rail";
import { Stars } from "@/components/rating";
import { homeData } from "@/lib/catalog";
import { getStoreSettings } from "@/lib/settings";
import { ik } from "@/lib/utils";

export const dynamic = "force-dynamic";

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (/frame|glass|sun|eye/.test(n)) return Glasses;
  if (/custom/.test(n)) return Palette;
  return Sparkles;
}

export default async function HomePage() {
  const [data, settings] = await Promise.all([homeData(), getStoreSettings()]);
  const hero = data.heroBanners[0];
  const featured = (data.categories.some((c) => c.isFeatured) ? data.categories.filter((c) => c.isFeatured) : data.categories).slice(0, 8);
  const catalogueEmpty = data.newArrivals.length === 0;

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      {hero ? (
        <section className="relative isolate overflow-hidden bg-ink text-white">
          {hero.imageUrl && (
            <Image src={ik(hero.imageUrl, 1600)} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-70" />
          )}
          <div className="container-store py-20 sm:py-28">
            <h1 className="max-w-xl font-display text-4xl font-bold leading-tight sm:text-5xl">{hero.title}</h1>
            {hero.subtitle && <p className="mt-4 max-w-lg text-base text-white/85">{hero.subtitle}</p>}
            {hero.ctaHref && (
              <Link href={hero.ctaHref} className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 font-semibold hover:bg-primary-hover">
                {hero.ctaLabel ?? "Shop now"} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="bg-blush-50">
          <div className="container-store grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:py-20">
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-primary">Beauty · Eyewear · Accessories</p>
              <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
                Made to be yours.
                <br />
                <span className="text-primary">Designed by you.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
                Frames, sunglasses and cosmetics you can personalise: colours, engraving, labels and more.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/shop" className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary-hover">
                  Shop the collection <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/shop?tag=custom" className="inline-flex h-12 items-center gap-2 rounded-lg border border-foreground/15 bg-white px-6 font-semibold hover:border-primary hover:text-primary">
                  <Palette className="h-4 w-4" /> Design your own
                </Link>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4">
              {data.categories.slice(0, 4).map((c, i) => {
                const Icon = categoryIcon(c.name);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/shop?category=${c.slug}`}
                      className={`group flex aspect-[4/3] flex-col justify-between rounded-2xl p-4 transition-transform hover:-translate-y-0.5 sm:p-5 ${
                        i === 0 ? "bg-primary text-primary-foreground" : i === 3 ? "bg-ink text-white" : "bg-white text-foreground shadow-card"
                      }`}
                    >
                      <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
                      <span className="flex items-center justify-between gap-2 font-display text-sm font-semibold sm:text-base">
                        {c.name}
                        <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ trust strip */}
      <section aria-label="Why shop with us" className="border-b border-border">
        <ul className="container-store grid gap-4 py-6 sm:grid-cols-3">
          {[
            { icon: Truck, title: `Free shipping over ${formatPaise(settings.freeShippingAbove, { whole: true })}`, text: `Standard delivery in ${settings.standardDays[0]}–${settings.standardDays[1]} days` },
            { icon: Palette, title: "Personalise it", text: "Colours, engraving, labels and packaging" },
            { icon: Sparkles, title: "Prices include GST", text: "What you see is what you pay for the product" },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* -------------------------------------------------------- categories */}
      {featured.length > 0 && (
        <section aria-labelledby="cats" className="container-store py-10">
          <div className="mb-5 flex items-end justify-between">
            <h2 id="cats" className="font-display text-xl font-semibold sm:text-2xl">
              Shop by category
            </h2>
            <Link href="/categories" className="text-sm font-semibold text-link hover:underline">
              All categories
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {featured.map((c) => {
              const Icon = categoryIcon(c.name);
              return (
                <li key={c.id}>
                  <Link href={`/shop?category=${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-product">
                    <span className="relative flex aspect-[16/10] items-center justify-center bg-blush-50 text-primary">
                      {c.imageUrl ? (
                        <Image src={ik(c.imageUrl, 600)} alt="" fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" />
                      ) : (
                        <Icon className="h-9 w-9" strokeWidth={1.25} aria-hidden="true" />
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-2 p-3 text-sm font-semibold">
                      {c.name}
                      {c.isCustomizable && <span className="rounded-full bg-accent px-2 py-0.5 text-2xs font-semibold text-accent-foreground">Custom</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {catalogueEmpty ? (
        <section className="container-store py-12">
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-14 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-display text-xl font-semibold">Our collection is arriving soon</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              We&apos;re adding products right now. Subscribe below to hear the moment we launch.
            </p>
          </div>
        </section>
      ) : (
        <>
          <ProductRail id="trending" title="Trending now" subtitle="What shoppers are loving this week" href="/shop?sort=popular" products={data.trending} />
          <ProductRail id="best" title="Best sellers" href="/shop?tag=bestseller" products={data.bestSellers} />
          <ProductRail id="new" title="New arrivals" subtitle="Fresh in the store" href="/shop?tag=new" products={data.newArrivals} />
          {data.customizable.length > 0 && (
            <div className="bg-blush-50">
              <ProductRail
                id="custom"
                title="Make it yours"
                subtitle="Customise colours, engraving and labels"
                href="/shop?tag=custom"
                products={data.customizable}
              />
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------ promo banners */}
      {data.promoBanners.length > 0 && (
        <section aria-label="Offers" className="container-store grid gap-4 py-8 md:grid-cols-2">
          {data.promoBanners.map((b) => (
            <Link key={b.id} href={b.ctaHref ?? "/shop"} className="relative isolate flex min-h-44 flex-col justify-end overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground">
              {b.imageUrl && <Image src={ik(b.imageUrl, 900)} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="-z-10 object-cover opacity-60" />}
              <span className="font-display text-2xl font-bold">{b.title}</span>
              {b.subtitle && <span className="mt-1 text-sm text-white/90">{b.subtitle}</span>}
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
                {b.ctaLabel ?? "Shop now"} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </section>
      )}

      {/* ------------------------------------------------------------ brands */}
      {data.brands.length > 0 && (
        <section aria-labelledby="brands" className="container-store py-8">
          <h2 id="brands" className="mb-5 font-display text-xl font-semibold sm:text-2xl">
            Featured brands
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {data.brands.map((b) => (
              <li key={b.slug}>
                <Link href={`/shop?brand=${b.slug}`} className="relative flex h-20 items-center justify-center rounded-xl border border-border bg-card px-4 text-center font-display font-semibold hover:border-primary hover:text-primary">
                  {b.logoUrl ? <Image src={ik(b.logoUrl, 300)} alt={b.name} fill sizes="200px" className="object-contain p-4" /> : b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ----------------------------------------------------------- reviews */}
      {data.reviews.length > 0 && (
        <section aria-labelledby="reviews" className="container-store py-10">
          <h2 id="reviews" className="mb-5 font-display text-xl font-semibold sm:text-2xl">
            What customers say
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {data.reviews.slice(0, 3).map((r) => (
              <li key={r.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
                <Quote className="h-6 w-6 text-highlight" aria-hidden="true" />
                <Stars value={r.rating} className="mt-3" />
                {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
                <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{r.body}</p>
                <p className="mt-auto pt-4 text-sm">
                  <span className="font-semibold">{r.author}</span>
                  <span className="text-muted-foreground"> on </span>
                  <Link href={`/products/${r.productSlug}`} className="text-link hover:underline">
                    {r.productName}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
