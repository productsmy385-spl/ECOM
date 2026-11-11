"use client";

import type { Suggestions } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { Loader2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Option = { href: string; label: string; meta?: string; kind: "product" | "category" | "brand" };

/** Header search with type-ahead suggestions (accessible combobox). */
export function SearchBox({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const box = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const term = q.trim();
    // Short queries show nothing (see `visible` below); no fetch needed.
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const s = (await res.json()) as Suggestions;
        setOptions([
          ...s.products.map((p) => ({ href: `/products/${p.slug}`, label: p.name, meta: formatPaise(p.price), kind: "product" as const })),
          ...s.categories.map((c) => ({ href: `/shop?category=${c.slug}`, label: c.name, meta: "Category", kind: "category" as const })),
          ...s.brands.map((b) => ({ href: `/shop?brand=${b.slug}`, label: b.name, meta: "Brand", kind: "brand" as const })),
        ]);
        setActive(-1);
      } catch {
        /* aborted or offline — keep previous suggestions */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    const choice = visible[active];
    if (choice) router.push(choice.href);
    else if (q.trim()) router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!visible.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % visible.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? visible.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && q.trim().length >= 2;
  const visible = q.trim().length >= 2 ? options : [];

  return (
    <form ref={box} role="search" onSubmit={submit} className={cn("relative", className)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search products, brands and categories
      </label>
      <div className="flex h-11 items-center rounded-full border border-input bg-muted/60 pl-4 pr-1 transition-colors focus-within:border-ring focus-within:bg-white">
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="Search photo frames, resin frames, collages…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover" aria-label="Search">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </button>
      </div>
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-dropdown">
          {visible.length === 0 && !loading && <li className="px-3 py-3 text-sm text-muted-foreground">No matches. Press Enter to search everything.</li>}
          {visible.map((o, i) => (
            <li
              key={o.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault();
                setOpen(false);
                router.push(o.href);
              }}
              className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm", i === active ? "bg-accent" : "hover:bg-muted")}
            >
              <span className="truncate">{o.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{o.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
