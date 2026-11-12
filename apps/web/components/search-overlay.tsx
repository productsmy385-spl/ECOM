"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SearchBox } from "./search-box";

/**
 * Header search icon → search panel (full screen on phones, a top sheet on
 * larger screens). Flipkart-style: only the search box with recent/trending
 * searches and live suggestions; filters come on the results page.
 */
export function SearchOverlay() {
  const path = usePathname();
  // Remembers the page it was opened on, so navigating anywhere closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const close = () => setOpenOn(null);

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

  // "/" opens search from anywhere (like most large stores), unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) {
        e.preventDefault();
        setOpenOn(path);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [path]);

  return (
    <>
      <button type="button" onClick={() => setOpenOn(path)} aria-label="Search" aria-expanded={open} className="flex h-10 w-10 items-center justify-center rounded-full hover:text-primary">
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
      {/* Portalled to <body>: the sticky header's backdrop-blur would otherwise
          become the containing block for this "fixed" panel and clip it. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] animate-fade-in">
          <div className="absolute inset-0 hidden bg-black/40 sm:block" onClick={close} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search the store"
            className="relative mx-auto flex h-full w-full flex-col bg-white p-3 sm:mt-6 sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-2xl sm:p-4 sm:shadow-modal"
          >
            <Suspense>
              <SearchBox autoFocus onClose={close} className="min-h-0 sm:max-h-[calc(80vh-2rem)]" />
            </Suspense>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
