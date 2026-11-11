import { brand } from "@ecom/ui/brand";
import { AdiraLogo } from "@ecom/ui/logo";
import { formatPaise } from "@ecom/ui/format";
import { cartCount } from "@ecom/services";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { navCategories } from "@/lib/catalog";
import { getCustomer } from "@/lib/customer";
import { resolveShopper } from "@/lib/design-owner";
import { getStoreSettings } from "@/lib/settings";
import { AccountMenu } from "./account-menu";
import { CartHeaderLink } from "./add-to-cart";
import { MobileNav } from "./mobile-nav";
import { SearchOverlay } from "./search-overlay";
import { WishlistHeaderLink } from "./wishlist";

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label={`${brand.name} home`}>
      <AdiraLogo size={38} name={brand.name} />
    </Link>
  );
}

const navLink = "inline-flex items-center gap-1 py-2 text-[0.8rem] font-semibold uppercase tracking-[0.09em] text-foreground transition-colors duration-300 hover:text-primary";

export async function SiteHeader() {
  const [cats, settings, customer, shopper] = await Promise.all([navCategories(), getStoreSettings(), getCustomer(), resolveShopper({ create: false })]);
  const bagCount = shopper ? await cartCount(shopper) : 0;
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      {/* Info strip: three short messages, all from store settings. */}
      <div className="hidden border-b border-border md:block">
        <div className="grid grid-cols-3 text-center text-xs text-foreground/80">
          <p className="py-2">
            Need any help?{" "}
            {support ? (
              <a href={`mailto:${support}`} className="font-medium text-primary hover:underline">
                {support}
              </a>
            ) : (
              <Link href="/contact" className="font-medium text-primary hover:underline">
                Contact us
              </Link>
            )}
          </p>
          <p className="border-x border-border py-2">
            Free shipping on orders above {formatPaise(settings.freeShippingAbove, { whole: true })}.{" "}
            <Link href="/shop" className="font-medium underline underline-offset-2 hover:text-primary">
              Shop now
            </Link>
          </p>
          <p className="py-2">
            Delivery in {settings.standardDays[0]}–{settings.standardDays[1]} business days · Prices include GST
          </p>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="container-store flex h-16 items-center gap-4 lg:h-20">
          <Logo />

          <nav aria-label="Main" className="mx-auto hidden lg:block">
            <ul className="flex items-center gap-7 xl:gap-9">
              <li>
                <Link href="/" className={navLink}>
                  Home
                </Link>
              </li>
              <li className="group relative">
                <Link href="/shop" className={navLink} aria-haspopup="true">
                  Shop <ChevronDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180" aria-hidden="true" />
                </Link>
                {cats.length > 0 && (
                  <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition-opacity duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <ul className="grid w-max min-w-64 max-w-[42rem] grid-cols-2 gap-x-2 rounded-2xl border border-border bg-card p-3 shadow-dropdown group-hover:animate-rise">
                      <li className="col-span-2">
                        <Link href="/shop" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted hover:text-primary">
                          Shop all
                        </Link>
                      </li>
                      {cats.map((c) => (
                        <li key={c.id}>
                          <Link href={`/shop?category=${c.slug}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-muted hover:text-primary">
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
              <li>
                <Link href="/shop?tag=new" className={navLink}>
                  New arrivals
                </Link>
              </li>
              <li>
                <Link href="/shop?tag=custom" className={`${navLink} text-primary`}>
                  Design your own
                </Link>
              </li>
              <li>
                <Link href="/about" className={navLink}>
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className={navLink}>
                  Contact
                </Link>
              </li>
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
            <SearchOverlay categories={cats.map((c) => ({ slug: c.slug, name: c.name }))} />
            <AccountMenu name={customer?.name ?? null} />
            <WishlistHeaderLink />
            <CartHeaderLink count={bagCount} />
            <MobileNav categories={cats} brand={brand.name} />
          </div>
        </div>
      </div>
    </header>
  );
}
