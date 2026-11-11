"use client";

import { Heart, LayoutGrid, LogOut, MapPin, Palette, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Overview", icon: LayoutGrid },
  { href: "/account/profile", label: "Profile & security", icon: UserRound },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/designs", label: "My designs", icon: Palette },
];

export function AccountNav() {
  const path = usePathname();
  const { signOut: clerkSignOut } = useClerk();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await clerkSignOut({ redirectUrl: "/" });
  }

  return (
    <nav aria-label="Account" className="lg:sticky lg:top-40 lg:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/account" ? path === href : path.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm", active ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-2 lg:border-t lg:border-border lg:pt-2">
          <button type="button" onClick={signOut} disabled={busy} className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-60">
            <LogOut className="h-4 w-4" aria-hidden="true" /> {busy ? "Signing out…" : "Sign out"}
          </button>
        </li>
      </ul>
    </nav>
  );
}
