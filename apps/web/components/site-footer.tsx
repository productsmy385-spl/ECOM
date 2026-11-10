import { brand } from "@ecom/ui/brand";
import Link from "next/link";
import { navCategories } from "@/lib/catalog";
import { NewsletterForm } from "./newsletter-form";

export async function SiteFooter() {
  const cats = await navCategories();
  return (
    <footer className="mt-16 bg-ink text-white">
      <section className="border-b border-white/10" aria-labelledby="newsletter-heading">
        <div className="container-store flex flex-col gap-4 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="newsletter-heading" className="font-display text-xl font-semibold">
              First look at new drops
            </h2>
            <p className="mt-1 text-sm text-white/70">New collections and offers, at most twice a month. Unsubscribe any time.</p>
          </div>
          <NewsletterForm />
        </div>
      </section>
      <div className="container-store grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-xl font-bold">{brand.name}</p>
          <p className="mt-2 max-w-xs text-sm text-white/70">Beauty, eyewear and accessories, with personalisation built in.</p>
        </div>
        <nav aria-label="Shop">
          <h2 className="text-sm font-semibold">Shop</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            {cats.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/shop?category=${c.slug}`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Discover">
          <h2 className="text-sm font-semibold">Discover</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>
              <Link href="/shop?tag=new" className="hover:text-white">
                New arrivals
              </Link>
            </li>
            <li>
              <Link href="/shop?tag=bestseller" className="hover:text-white">
                Best sellers
              </Link>
            </li>
            <li>
              <Link href="/shop?tag=custom" className="hover:text-white">
                Customisable products
              </Link>
            </li>
            <li>
              <Link href="/categories" className="hover:text-white">
                All categories
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <h2 className="text-sm font-semibold">Company</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>
              <Link href="/about" className="hover:text-white">
                About us
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="container-store py-5 text-xs text-white/50">
          &copy; {new Date().getFullYear()} {brand.name}. Prices include GST.
        </p>
      </div>
    </footer>
  );
}
