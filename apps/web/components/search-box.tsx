"use client";

import type { Suggestions } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { ArrowLeft, ArrowUpRight, Clock, Loader2, Search, TrendingUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

const RECENT_KEY = "adira:recent-searches";
const MAX_RECENT = 8;
/** Popular search terms (they open search results, not category filters). */
const TRENDING = ["photo frame", "resin frame", "collage frame", "name frame", "wedding gift", "baby frame", "wall frame"];

type Row = { kind: "query"; q: string } | { kind: "product"; slug: string; name: string; imageUrl: string | null; price: number };

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {}
}

/**
 * Flipkart-style search: type, see live product suggestions, press Enter for
 * the results page, where filters and sorting narrow things down. Before
 * typing it shows recent and trending searches. No category filters up front.
 */
export function SearchBox({ className, autoFocus, onClose }: { className?: string; autoFocus?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [products, setProducts] = useState<Extract<Row, { kind: "product" }>[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const listId = useId();
  const term = q.trim();
  const typing = term.length >= 2;

  useEffect(() => {
    const id = requestAnimationFrame(() => setRecent(readRecent()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!typing) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const s = (await res.json()) as Suggestions;
        setProducts(s.products.map((p) => ({ kind: "product" as const, ...p })));
        setActive(-1);
      } catch {
        /* aborted or offline: keep previous suggestions */
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, typing]);

  const rows: Row[] = typing ? [{ kind: "query", q: term }, ...products] : [...recent.map((r) => ({ kind: "query" as const, q: r }))];

  function search(value: string) {
    const v = value.trim();
    if (!v) return;
    const next = [v, ...readRecent().filter((r) => r.toLowerCase() !== v.toLowerCase())];
    writeRecent(next);
    setRecent(next.slice(0, MAX_RECENT));
    onClose?.();
    router.push(`/shop?q=${encodeURIComponent(v)}`);
  }

  function go(row: Row) {
    if (row.kind === "query") return search(row.q);
    if (term) writeRecent([term, ...readRecent().filter((r) => r.toLowerCase() !== term.toLowerCase())]);
    onClose?.();
    router.push(`/products/${row.slug}`);
  }

  function removeRecent(r: string) {
    const next = readRecent().filter((x) => x !== r);
    writeRecent(next);
    setRecent(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && rows.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % rows.length);
    } else if (e.key === "ArrowUp" && rows.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? rows.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = rows[active];
      if (r) go(r);
      else search(q);
    }
  }

  const rowCls = (i: number) => cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", i === active ? "bg-accent" : "hover:bg-muted");

  return (
    <div role="search" className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close search" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search for products
        </label>
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-muted/50 px-3 focus-within:border-primary focus-within:bg-white">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            id={`${listId}-input`}
            type="text"
            inputMode="search"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            autoFocus={autoFocus}
            placeholder="Search for photo frames, resin art, gifts…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(-1);
              if (e.target.value.trim().length < 2) setProducts([]);
            }}
            onKeyDown={onKeyDown}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="rounded-full p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => search(q)} className="hidden h-12 shrink-0 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover sm:block">
          Search
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        {typing ? (
          <ul id={listId} role="listbox" aria-label="Suggestions" className="space-y-0.5">
            {rows.map((r, i) =>
              r.kind === "query" ? (
                <li key="q" id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button type="button" onClick={() => go(r)} className={rowCls(i)}>
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">
                      Search for <strong>“{r.q}”</strong>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ) : (
                <li key={r.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button type="button" onClick={() => go(r)} className={rowCls(i)}>
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                      <ProductImage src={r.imageUrl} alt="" sizes="48px" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="text-xs font-semibold text-primary">{formatPaise(r.price)}</span>
                    </span>
                  </button>
                </li>
              ),
            )}
            {!loading && products.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No product name matches. Press Enter to see all results.</li>}
          </ul>
        ) : (
          <div className="space-y-6">
            {recent.length > 0 && (
              <section aria-labelledby={`${listId}-recent`}>
                <h2 id={`${listId}-recent`} className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent searches
                </h2>
                <ul id={listId} role="listbox" aria-label="Recent searches" className="mt-1 space-y-0.5">
                  {recent.map((r, i) => (
                    <li key={r} id={`${listId}-${i}`} role="option" aria-selected={i === active} className="group flex items-center">
                      <button type="button" onClick={() => search(r)} className={cn(rowCls(i), "flex-1")}>
                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate">{r}</span>
                      </button>
                      <button type="button" onClick={() => removeRecent(r)} aria-label={`Remove ${r} from recent searches`} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-labelledby={`${listId}-trending`}>
              <h2 id={`${listId}-trending`} className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trending searches
              </h2>
              <ul className="mt-2 flex flex-wrap gap-2 px-3">
                {TRENDING.map((t) => (
                  <li key={t}>
                    <button type="button" onClick={() => search(t)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm hover:border-primary hover:text-primary">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> {t}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
