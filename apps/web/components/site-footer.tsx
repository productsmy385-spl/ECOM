import { brand } from "@ecom/ui/brand";
import { AdiraLogo } from "@ecom/ui/logo";
import Link from "next/link";
import { navCategories } from "@/lib/catalog";
import { NewsletterForm } from "./newsletter-form";

const linkCls = "text-sm text-white/70 transition-colors duration-300 hover:text-hotpink";

export async function SiteFooter() {
  const cats = await navCategories();
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <footer className="mt-10 bg-ink text-white">
      <section className="border-b border-white/10" aria-labelledby="newsletter-heading">
        <div className="container-store flex flex-col gap-5 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="newsletter-heading" className="font-display text-2xl font-semibold">
              First look at new drops
            </h2>
            <p className="mt-1 text-sm text-white/70">New collections and offers, at most twice a month. Unsubscribe any time.</p>
          </div>
          <NewsletterForm />
        </div>
      </section>

      <div className="container-store grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" aria-label={`${brand.name} home`}>
            <AdiraLogo size={40} name={brand.name} />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-white/70">Custom photo frames and handmade resin art frames, designed by you.</p>
        </div>
        <nav aria-label="Shop">
          <h2 className="text-sm font-semibold uppercase tracking-[0.09em]">Shop</h2>
          <ul className="mt-4 space-y-2.5">
            {cats.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/shop?category=${c.slug}`} className={linkCls}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Discover">
          <h2 className="text-sm font-semibold uppercase tracking-[0.09em]">Discover</h2>
          <ul className="mt-4 space-y-2.5">
            {[
              ["/shop?tag=new", "New arrivals"],
              ["/shop?tag=bestseller", "Best sellers"],
              ["/shop?tag=custom", "Design your own"],
              ["/categories", "All categories"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href!} className={linkCls}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Account">
          <h2 className="text-sm font-semibold uppercase tracking-[0.09em]">Account</h2>
          <ul className="mt-4 space-y-2.5">
            {[
              ["/account", "My account"],
              ["/account/orders", "My orders"],
              ["/designs", "My designs"],
              ["/cart", "Bag"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href!} className={linkCls}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Help">
          <h2 className="text-sm font-semibold uppercase tracking-[0.09em]">Help</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/about" className={linkCls}>
                About us
              </Link>
            </li>
            <li>
              <Link href="/contact" className={linkCls}>
                Contact
              </Link>
            </li>
            {support && (
              <li>
                <a href={`mailto:${support}`} className={`${linkCls} break-all`}>
                  {support}
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="container-store flex flex-col gap-2 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {brand.name}. All rights reserved. Prices include GST.
          </p>
          <p>Designed by Kranas Tech</p>
        </div>
      </div>
    </footer>
  );
}
