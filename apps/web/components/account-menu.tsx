"use client";

import { ChevronDown, Heart, LayoutGrid, LogOut, MapPin, Palette, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AccountMenu({ name }: { name: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!name) {
    const next = path.startsWith("/login") || path.startsWith("/register") ? "" : `?next=${encodeURIComponent(path)}`;
    return (
      <Link href={`/login${next}`} className="flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold hover:bg-muted sm:px-3">
        <UserRound className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  const item = "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted";
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold hover:bg-muted sm:px-3">
        <UserRound className="h-5 w-5" aria-hidden="true" />
        <span className="hidden max-w-28 truncate sm:inline">{name.split(" ")[0]}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-dropdown">
          <Link role="menuitem" href="/account" onClick={() => setOpen(false)} className={item}><LayoutGrid className="h-4 w-4" /> My account</Link>
          <Link role="menuitem" href="/designs" onClick={() => setOpen(false)} className={item}><Palette className="h-4 w-4" /> My designs</Link>
          <Link role="menuitem" href="/account/wishlist" onClick={() => setOpen(false)} className={item}><Heart className="h-4 w-4" /> Wishlist</Link>
          <Link role="menuitem" href="/account/addresses" onClick={() => setOpen(false)} className={item}><MapPin className="h-4 w-4" /> Addresses</Link>
          <button
            role="menuitem"
            type="button"
            className={`${item} w-full text-destructive`}
            onClick={async () => {
              setOpen(false);
              await authClient.signOut();
              router.refresh();
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
