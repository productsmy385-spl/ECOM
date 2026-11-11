import { accountOverview } from "@ecom/services";
import { formatDateIN } from "@ecom/ui/format";
import { Heart, MapPin, Palette, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomer } from "@/lib/customer";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage() {
  const c = await requireCustomer("/account");
  const { profile, counts } = await accountOverview({ userId: c.userId });
  const cards: { href: string; label: string; value: number; hint: string; icon: LucideIcon }[] = [
    { href: "/designs", label: "Designs", value: counts.designs, hint: "Saved customisations", icon: Palette },
    { href: "/account/wishlist", label: "Wishlist", value: counts.wishlist, hint: "Products you saved", icon: Heart },
    { href: "/account/addresses", label: "Addresses", value: counts.addresses, hint: "For faster checkout", icon: MapPin },
  ];
  return (
    <div className="space-y-6">
      <ul className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ href, label, value, hint, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex h-full items-start justify-between gap-3 rounded-xl border border-border bg-card p-5 hover:shadow-product">
              <span>
                <span className="block text-sm text-muted-foreground">{label}</span>
                <span className="mt-1 block font-display text-2xl font-semibold tabular-nums">{value}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Your details</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{profile.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{profile.email}</dd>
          <dt className="text-muted-foreground">Mobile</dt>
          <dd>{profile.phone ?? "Not added"}</dd>
          <dt className="text-muted-foreground">Member since</dt>
          <dd>{formatDateIN(profile.createdAt)}</dd>
        </dl>
        <Link href="/account/profile" className="mt-4 inline-block text-sm font-semibold text-link hover:underline">
          Edit profile
        </Link>
      </section>
      <p className="text-sm text-muted-foreground">Orders and invoices will appear here once checkout opens.</p>
    </div>
  );
}
