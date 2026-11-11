import { brand } from "@ecom/ui/brand";
import { formatPaise } from "@ecom/ui/format";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { navCategories } from "@/lib/catalog";
import { getStoreSettings } from "@/lib/settings";
import { getCustomer } from "@/lib/customer";
import { resolveShopper } from "@/lib/design-owner";
import { cartCount } from "@ecom/services";
import { CartHeaderLink } from "./add-to-cart";
import { AccountMenu } from "./account-menu";
import { MobileNav } from "./mobile-nav";
import { WishlistHeaderLink } from "./wishlist";
import { SearchBox } from "./search-box";

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${brand.name} home`}>
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-display text-lg font-bold text-primary-foreground">
        {brand.name.charAt(0)}
      </span>
      <span className="font-display text-xl font-bold tracking-tight">{brand.name}</span>
    </Link>
  );
}

export async function SiteHeader() {
  const [cats, settings, customer, shopper] = await Promise.all([navCategories(), getStoreSettings(), getCustomer(), resolveShopper({ create: false })]);
  const bagCount = shopper ? await cartCount(shopper) : 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      {/* Announcement bar: the offer is read from store settings, not hard-coded. */}
      <div className="bg-ink text-white">
        <p className="container-store py-2 text-center text-xs font-medium">
          Free shipping on orders above {formatPaise(settings.freeShippingAbove, { whole: true })} ·{" "}
          <Link href="/shop?tag=custom" className="text-hotpink underline-offset-2 hover:underline">
            Design your own
          </Link>
        </p>
      </div>

      <div className="border-b border-border">
        <div className="container-store flex h-16 items-center gap-3 lg:h-[72px] lg:gap-8">
          <MobileNav categories={cats} brand={brand.name} />
          <Logo />
          <Suspense fallback={<div className="hidden h-11 flex-1 rounded-full bg-muted md:block" />}>
            <SearchBox className="hidden flex-1 md:block lg:max-w-2xl" />
          </Suspense>
          <div className="ml-auto flex items-center gap-1">
            <AccountMenu name={customer?.name ?? null} />
            <WishlistHeaderLink />
            <CartHeaderLink count={bagCount} />
          </div>
        </div>
        <div className="container-store pb-3 md:hidden">
          <Suspense fallback={<div className="h-11 rounded-full bg-muted" />}>
            <SearchBox />
          </Suspense>
        </div>
      </div>

      <nav aria-label="Categories" className="hidden border-b border-border lg:block">
        {/* Labels never wrap; if categories outgrow the width the bar scrolls instead. */}
        <ul className="container-store flex items-center gap-0.5 whitespace-nowrap text-sm xl:gap-1 [&>li]:shrink-0">
          {/* (dropdowns are absolutely positioned, so they are not clipped by the bar) */}
          <li>
            <Link href="/shop" className="block px-3 py-3 font-medium hover:text-primary">
              Shop all
            </Link>
          </li>
          {cats.map((c) => (
            <li key={c.id} className="group relative">
              <Link href={`/shop?category=${c.slug}`} className="flex items-center gap-1 px-3 py-3 hover:text-primary">
                {c.name}
                {c.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" aria-hidden="true" />}
              </Link>
              {c.children.length > 0 && (
                <ul className="invisible absolute left-0 top-full z-50 min-w-52 rounded-xl border border-border bg-card p-1.5 opacity-0 shadow-dropdown transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {c.children.map((ch) => (
                    <li key={ch.id}>
                      <Link href={`/shop?category=${ch.slug}`} className="block rounded-lg px-3 py-2 hover:bg-muted">
                        {ch.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          <li className="ml-auto">
            <Link href="/shop?tag=new" className="block px-3 py-3 font-medium text-primary hover:underline">
              New arrivals
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
