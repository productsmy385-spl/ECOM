import type { ProductCard } from "@ecom/services";
import type { HomeSectionKey, WebsiteSettings } from "@ecom/validation";
import { Fragment } from "react";
import { formatPaise } from "@ecom/ui/format";
import { BadgePercent, Flower2, Frame, LayoutGrid, Palette, Quote, ShieldCheck, Sparkles, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Carousel } from "@/components/carousel";
import { Countdown } from "@/components/countdown";
import { ProductImage } from "@/components/product-image";
import { ProductRail } from "@/components/product-rail";
import { Stars } from "@/components/rating";
import { Reveal } from "@/components/reveal";
import { homeData } from "@/lib/catalog";
import { getStoreSettings } from "@/lib/settings";
import { websiteSettings } from "@/lib/website";
import { ik } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Slide = { key: string; eyebrow?: string; title: React.ReactNode; text: string; cta: { href: string; label: string }; image: string | null; hint: string };

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (/resin|glu/.test(n)) return Flower2;
  if (/collage/.test(n)) return LayoutGrid;
  if (/custom|name|gift/.test(n)) return Palette;
  return Frame;
}

/** Hero slides: admin banners when there are any, otherwise built from the live catalogue. */
function heroSlides(data: Awaited<ReturnType<typeof homeData>>): Slide[] {
  if (data.heroBanners.length) {
    return data.heroBanners.map((b) => ({
      key: b.id,
      title: b.title,
      text: b.subtitle ?? "",
      cta: { href: b.ctaHref ?? "/shop", label: b.ctaLabel ?? "Shop collection" },
      image: b.imageUrl,
      hint: b.title,
    }));
  }
  const img = (list: ProductCard[]) => list.find((p) => p.imageUrl)?.imageUrl ?? null;
  return [
    {
      key: "yours",
      eyebrow: "Photo frames · Resin art · Custom designs",
      title: (
        <>
          Made to be yours. <span className="text-primary">Designed by you.</span>
        </>
      ),
      text: "Custom photo frames and handmade resin art frames, designed by you: your photos, names, flowers and colours.",
      cta: { href: "/shop", label: "Shop collection" },
      image: img(data.trending),
      hint: "Our collection",
    },
    {
      key: "custom",
      eyebrow: "Personalisation studio",
      title: "Design your own, see it live",
      text: "Upload your photo, add names and dates, choose the frame and see it live before you order.",
      cta: { href: "/shop?tag=custom", label: "Start designing" },
      image: img(data.customizable),
      hint: "Design your own",
    },
    {
      key: "new",
      eyebrow: "Just landed",
      title: "New arrivals, fresh every week",
      text: "The latest photo, collage and resin frames, first.",
      cta: { href: "/shop?tag=new", label: "Shop new arrivals" },
      image: img(data.newArrivals),
      hint: "New arrivals",
    },
  ];
}

function MiniList({ title, items }: { title: string; items: ProductCard[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border p-6">
      <h3 className="mb-6 font-display text-xl font-semibold">{title}</h3>
      <ul className="divide-y divide-border">
        {items.slice(0, 3).map((p) => (
          <li key={p.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <Link href={`/products/${p.slug}`} className="relative h-[90px] w-20 shrink-0 overflow-hidden rounded-lg bg-muted shadow-sm">
              <ProductImage src={p.imageUrl} alt="" sizes="80px" />
            </Link>
            <div className="min-w-0">
              <Link href={`/products/${p.slug}`} className="line-clamp-2 text-sm font-bold hover:text-primary">
                {p.name}
              </Link>
              <p className="mt-1 truncate text-xs text-muted-foreground">{p.brandName ?? p.categoryName}</p>
              {p.ratingCount > 0 && <Stars value={p.ratingAvg} className="mt-1 [&_svg]:h-3.5 [&_svg]:w-3.5" />}
              <p className="mt-1 font-bold text-primary">{formatPaise(p.price)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeroImage({ s, priority, className }: { s: Slide; priority: boolean; className?: string }) {
  return s.image ? (
    <Image src={ik(s.image, 1400)} alt="" fill priority={priority} sizes="(min-width: 768px) 50vw, 90vw" className={className ?? "object-cover"} />
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-blush to-white text-primary">
      <Sparkles className="h-16 w-16" strokeWidth={1.2} aria-hidden="true" />
      <span className="font-display text-lg font-semibold">{s.hint}</span>
    </div>
  );
}

function HeroHeading({ s, first, className }: { s: Slide; first: boolean; className: string }) {
  return first ? <h1 className={className}>{s.title}</h1> : <h2 className={className}>{s.title}</h2>;
}

/** The billboard in one of three layouts chosen in Admin → Website settings. */
function Hero({ slides, style }: { slides: Slide[]; style: WebsiteSettings["heroStyle"] }) {
  const titleCls = "mt-3 font-display text-4xl font-semibold leading-[1.1] tracking-wide sm:text-5xl lg:text-6xl";
  if (style === "banner") {
    return (
      <section aria-label="Highlights" className="relative overflow-hidden bg-ink">
        <Carousel label="Highlights" breakpoints={{ 0: 1 }} gap={0} loop autoplayMs={7000}>
          {slides.map((s, i) => (
            <div key={s.key} className="relative flex min-h-[520px] items-center lg:min-h-[640px]">
              <div className="absolute inset-0">
                <HeroImage s={s} priority={i === 0} />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" aria-hidden="true" />
              </div>
              <div className="container-store relative py-16 text-white">
                <div className="max-w-xl">
                  {s.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-highlight sm:text-sm">{s.eyebrow}</p>}
                  <HeroHeading s={s} first={i === 0} className={`${titleCls} [&_span]:text-highlight`} />
                  {s.text && <p className="mt-5 max-w-md text-lg text-white/85">{s.text}</p>}
                  <Link href={s.cta.href} className="btn-pill btn-pill-light mt-8">
                    {s.cta.label}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </Carousel>
      </section>
    );
  }
  if (style === "centered") {
    return (
      <section aria-label="Highlights" className="relative overflow-hidden bg-blush-50">
        <div className="container-store relative">
          <Carousel label="Highlights" breakpoints={{ 0: 1 }} gap={0} loop autoplayMs={7000}>
            {slides.map((s, i) => (
              <div key={s.key} className="flex flex-col items-center py-14 text-center md:py-20">
                {s.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">{s.eyebrow}</p>}
                <HeroHeading s={s} first={i === 0} className={`${titleCls} max-w-3xl`} />
                {s.text && <p className="mx-auto mt-5 max-w-xl text-lg text-foreground/75">{s.text}</p>}
                <Link href={s.cta.href} className="btn-pill mt-8">
                  {s.cta.label}
                </Link>
                <div className="relative mt-10 aspect-[16/7] w-full max-w-4xl overflow-hidden rounded-[var(--radius-media,2rem)] bg-white shadow-product">
                  <HeroImage s={s} priority={i === 0} />
                </div>
              </div>
            ))}
          </Carousel>
        </div>
      </section>
    );
  }
  return (
    <section aria-label="Highlights" className="relative overflow-hidden bg-blush-50">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-blush" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-white/70" />
      <div className="container-store relative">
        <Carousel label="Highlights" breakpoints={{ 0: 1 }} gap={0} loop autoplayMs={7000}>
          {slides.map((s, i) => (
            <div key={s.key} className="grid min-h-[520px] items-center gap-8 py-12 md:grid-cols-2 md:py-16 lg:min-h-[620px]">
              <div className="order-2 text-center md:order-1 md:pl-6 md:text-left lg:pl-14">
                {s.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary sm:text-sm">{s.eyebrow}</p>}
                <HeroHeading s={s} first={i === 0} className={titleCls} />
                {s.text && <p className="mx-auto mt-5 max-w-md text-lg text-foreground/75 md:mx-0">{s.text}</p>}
                <Link href={s.cta.href} className="btn-pill mt-8">
                  {s.cta.label}
                </Link>
              </div>
              <div className="order-1 flex justify-center md:order-2">
                <div className="relative aspect-square w-[70%] max-w-[460px] overflow-hidden rounded-[var(--radius-media,2rem)] bg-white shadow-product md:w-full">
                  <HeroImage s={s} priority={i === 0} />
                </div>
              </div>
            </div>
          ))}
        </Carousel>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [data, settings, site] = await Promise.all([homeData(), getStoreSettings(), websiteSettings()]);
  const slides = heroSlides(data);
  const catalogueEmpty = data.newArrivals.length === 0;
  const featuredCats = (data.categories.some((c) => c.isFeatured) ? data.categories.filter((c) => c.isFeatured) : data.categories).slice(0, 3);
  const promo = data.promoBanners[0];
  const bestReviewed = [...data.trending].filter((p) => p.ratingCount > 0).sort((a, b) => b.ratingAvg - a.ratingAvg);
  const bestSelling = data.bestSellers.length ? data.bestSellers : data.trending;

  // Each homepage section; Admin → Website settings decides the order and which are shown.
  const blocks: Record<HomeSectionKey, React.ReactNode> = {
    services: (
      <section aria-label="Why shop with us" className="pt-16 sm:pt-24">
        <Reveal className="container-store grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: "Free delivery", text: `On orders above ${formatPaise(settings.freeShippingAbove, { whole: true })}, in ${settings.standardDays[0]}–${settings.standardDays[1]} days.` },
            { icon: Sparkles, title: "Quality guarantee", text: "Every piece is checked before it leaves us." },
            { icon: BadgePercent, title: "Prices include GST", text: "What you see is what you pay for the product." },
            { icon: ShieldCheck, title: "100% secure payment", text: "UPI, cards and net banking, verified on our servers." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <Icon className="h-9 w-9 shrink-0 text-primary" strokeWidth={1.4} aria-hidden="true" />
              <div>
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-foreground/70">{text}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>
    ),
    bestSellers: catalogueEmpty ? (
      <section className="container-store py-16">
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-14 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
          <h2 className="mt-3 font-display text-xl font-semibold">Our collection is arriving soon</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">We&apos;re adding products right now. Subscribe below to hear the moment we launch.</p>
        </div>
      </section>
    ) : (
      <ProductRail id="best" title="Best selling items" href="/shop?sort=popular" products={bestSelling} />
    ),
    offer: (
      <section aria-label="Offer" className="relative overflow-hidden bg-accent">
        <Reveal className="container-store grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="flex justify-center">
            <div className="relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-[var(--radius-media,2rem)] bg-white shadow-product">
              {promo?.imageUrl ? (
                <Image src={ik(promo.imageUrl, 900)} alt="" fill sizes="(min-width: 768px) 45vw, 90vw" className="object-cover" />
              ) : data.customizable[0]?.imageUrl ? (
                <Image src={ik(data.customizable[0].imageUrl, 900)} alt="" fill sizes="(min-width: 768px) 45vw, 90vw" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-primary">
                  <Frame className="h-20 w-20" strokeWidth={1.1} aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
          <div className="text-center md:text-left">
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-wide sm:text-5xl">{promo ? promo.title : "Make it unmistakably yours"}</h2>
            <p className="mt-4 text-lg text-foreground/75">{promo ? promo.subtitle : "Upload your photos, pick flowers for resin, add names and dates. Our designers check every custom piece before it's made."}</p>
            {promo?.endsAt && <Countdown endsAt={promo.endsAt.toISOString()} />}
            <Link href={promo?.ctaHref ?? "/shop?tag=custom"} className="btn-pill btn-pill-dark mt-6">
              {promo?.ctaLabel ?? "Start designing"}
            </Link>
          </div>
        </Reveal>
      </section>
    ),
    collections: !catalogueEmpty && (
      <section aria-label="Collections" className="py-16 sm:py-24">
        <Reveal className="container-store grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MiniList title="Featured" items={data.trending} />
          <MiniList title="Latest items" items={data.newArrivals} />
          <MiniList title="Best reviewed" items={bestReviewed.length ? bestReviewed : data.bestSellers} />
          <MiniList title="On sale" items={data.onSale.length ? data.onSale : data.customizable} />
        </Reveal>
      </section>
    ),
    categories: featuredCats.length > 0 && (
      <section aria-labelledby="cats" className="py-16 sm:py-24">
        <Reveal className="container-store">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="cats" className="font-display text-2xl font-semibold tracking-wide sm:text-3xl">
              Shop by category
            </h2>
            <Link href="/categories" className="btn-pill self-start sm:self-auto">
              All categories
            </Link>
          </div>
          <ul className="grid gap-6 md:grid-cols-3">
            {featuredCats.map((c) => {
              const Icon = categoryIcon(c.name);
              return (
                <li key={c.id}>
                  <Link href={`/shop?category=${c.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-blush">
                    {c.imageUrl ? (
                      <Image src={ik(c.imageUrl, 800)} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-primary transition-transform duration-700 group-hover:scale-110">
                        <Icon className="h-20 w-20" strokeWidth={1.1} aria-hidden="true" />
                      </span>
                    )}
                    <span className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-[var(--radius-pill,9999px)] bg-white px-5 py-3 font-display font-semibold shadow-card transition-colors duration-300 group-hover:bg-primary group-hover:text-white">
                      {c.name}
                      <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </section>
    ),
    customizable: data.customizable.length > 0 && (
      <ProductRail id="custom" title="Make it yours" subtitle="Your photos, names, flowers and colours" href="/shop?tag=custom" products={data.customizable} className="bg-blush-50" />
    ),
    reviews: data.reviews.length > 0 && (
      <section aria-labelledby="reviews" className="bg-blush-50 py-16 sm:py-24">
        <Reveal className="container-store max-w-4xl">
          <h2 id="reviews" className="mb-10 text-center font-display text-2xl font-semibold tracking-wide sm:text-3xl">
            Customers reviews
          </h2>
          <Carousel label="Customer reviews" breakpoints={{ 0: 1 }} loop>
            {data.reviews.map((r) => (
              <figure key={r.id} className="px-2 text-center sm:px-12">
                <Quote className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <blockquote className="mt-4 text-lg leading-relaxed sm:text-xl">{r.body}</blockquote>
                <Stars value={r.rating} className="mt-4 justify-center" />
                <figcaption className="mt-3 text-sm">
                  <span className="font-semibold">{r.author}</span>
                  <span className="text-muted-foreground"> on </span>
                  <Link href={`/products/${r.productSlug}`} className="text-link hover:underline">
                    {r.productName}
                  </Link>
                </figcaption>
              </figure>
            ))}
          </Carousel>
        </Reveal>
      </section>
    ),
    brands: data.brands.length > 0 && (
      <section aria-labelledby="brands" className="py-14">
        <Reveal className="container-store">
          <h2 id="brands" className="sr-only">
            Our brands
          </h2>
          <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {data.brands.map((b) => (
              <li key={b.slug}>
                <Link href={`/shop?brand=${b.slug}`} className="brand-logo relative flex h-14 w-32 items-center justify-center font-display text-lg font-semibold">
                  {b.logoUrl ? <Image src={ik(b.logoUrl, 300)} alt={b.name} fill sizes="128px" className="object-contain" /> : b.name}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>
    ),
  };

  return (
    <>
      <Hero slides={slides} style={site.heroStyle} />
      {site.sections
        .filter((s) => s.enabled)
        .map((s) => (
          <Fragment key={s.key}>{blocks[s.key]}</Fragment>
        ))}
    </>
  );
}
