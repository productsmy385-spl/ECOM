"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SearchBox } from "./search-box";

/** Search icon in the header that opens a full-screen search with category shortcuts. */
export function SearchOverlay({ categories }: { categories: { slug: string; name: string }[] }) {
  const path = usePathname();
  // Remembers the page it was opened on, so navigating anywhere closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (o: boolean) => setOpenOn(o ? path : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search" aria-expanded={open} className="flex h-10 w-10 items-center justify-center rounded-full hover:text-primary">
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
      <div
        className="search-overlay fixed inset-0 z-[60] flex items-center justify-center bg-white"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Search the store"
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="spin-on-hover absolute right-4 top-4 rounded-full p-2 text-foreground/60 hover:text-foreground sm:right-8 sm:top-8">
          <X className="h-7 w-7" />
        </button>
        <div className="search-panel w-[90%] max-w-3xl text-center">
          {open && (
            <Suspense>
              <SearchBox autoFocus className="text-left [&_input]:h-16 [&_input]:text-lg" />
            </Suspense>
          )}
          {categories.length > 0 && (
            <>
              <p className="mt-10 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Browse categories</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-x-1 gap-y-2 font-display text-xl sm:text-2xl">
                {categories.map((c, i) => (
                  <li key={c.slug} className="flex items-center">
                    <Link href={`/shop?category=${c.slug}`} className="underline-rise hover:text-primary">
                      {c.name}
                    </Link>
                    {i < categories.length - 1 && <span className="px-2 text-foreground/40" aria-hidden="true">/</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
