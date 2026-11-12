import { brand } from "@ecom/ui/brand";
import { AdiraLogo } from "@ecom/ui/logo";
import { AtSign, Camera, Clock, MapPin, MessageCircle, Phone, Pin, PlayCircle, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { navCategories } from "@/lib/catalog";
import { websiteSettings } from "@/lib/website";
import { NewsletterForm } from "./newsletter-form";

const linkCls = "text-sm text-white/70 transition-colors duration-300 hover:text-highlight";

export async function SiteFooter() {
  const [cats, site] = await Promise.all([navCategories(), websiteSettings()]);
  const support = site.contact.email || process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const { contact } = site;
  const socials = (
    [
      ["instagram", "Instagram", Camera],
      ["facebook", "Facebook", ThumbsUp],
      ["youtube", "YouTube", PlayCircle],
      ["pinterest", "Pinterest", Pin],
      ["x", "X (Twitter)", AtSign],
    ] as const
  ).filter(([k]) => site.social[k]);
  const wa = contact.whatsapp.replace(/[^\d]/g, "");
  return (
    <footer className="mt-10 bg-ink text-white print:hidden">
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
            <AdiraLogo size={46} name={brand.name} />
          </Link>
          <p className="mt-3 max-w-xs text-sm text-white/70">{site.tagline || "Custom photo frames and handmade resin art frames, designed by you."}</p>
          {(contact.phone || wa || contact.address || contact.hours) && (
            <address className="mt-4 space-y-1.5 text-sm not-italic text-white/70">
              {contact.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:text-highlight">{contact.phone}</a>
                </p>
              )}
              {wa && (
                <p className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <a href={`https://wa.me/${wa}`} rel="noopener" target="_blank" className="hover:text-highlight">WhatsApp us</a>
                </p>
              )}
              {contact.address && (
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="whitespace-pre-line">{contact.address}</span>
                </p>
              )}
              {contact.hours && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {contact.hours}
                </p>
              )}
            </address>
          )}
          {socials.length > 0 && (
            <ul className="mt-5 flex gap-2" aria-label="Follow us">
              {socials.map(([k, label, Icon]) => (
                <li key={k}>
                  <a href={site.social[k]} target="_blank" rel="noopener" aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
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
