"use client";

import { AdiraLoader } from "@ecom/ui/loader";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Shows the animated Adira logo while the shopper moves between pages.
 *
 * Deliberately NOT a loading.tsx: a Suspense boundary at the root makes every
 * page stream with HTTP 200, so missing products would stop returning 404.
 * Instead this watches same-site link clicks and hides once the URL changes.
 * The overlay fades in after 350 ms (CSS delay), so fast navigations never
 * flash it, and it lets clicks through.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = `${pathname}?${search}`;
  // The URL we were on when a navigation started; pending while we're still there.
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const pending = startedOn === current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash only
      setStartedOn(`${location.pathname}?${location.search.replace(/^\?/, "")}`);
      clearTimeout(timer);
      // Safety net: never leave the overlay up if a navigation is abandoned.
      timer = setTimeout(() => setStartedOn(null), 12_000);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(timer);
    };
  }, []);

  if (!pending) return null;
  return (
    <div aria-hidden="true" className="nav-loader pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
      <AdiraLoader size={76} label="" />
    </div>
  );
}
