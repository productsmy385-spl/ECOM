"use client";

import { cn } from "@/lib/utils";
import { CornerDownLeft, FileText, Search, ShoppingBag, UserRound, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useShell } from "./shell-context";

type Item = { id: string; label: string; hint: string; href: string; icon: React.ComponentType<{ className?: string }> };

/**
 * DropX header search, made functional: Ctrl/⌘ K or "/" focuses it. Typing
 * jumps to any admin page your role can open, or searches orders, products
 * and customers (opening that list filtered by the text).
 */
export function GlobalSearch() {
  const router = useRouter();
  const { navigation, can } = useShell();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const pages = useMemo(
    () =>
      navigation.flatMap((g) =>
        g.items.map((i) => ({ id: `page:${i.href}`, label: i.title, hint: g.label, href: i.href, icon: i.icon ?? FileText })),
      ),
    [navigation],
  );

  const term = q.trim();
  const items: Item[] = useMemo(() => {
    const t = term.toLowerCase();
    const matched = (t ? pages.filter((p) => p.label.toLowerCase().includes(t) || p.hint.toLowerCase().includes(t)) : pages).slice(0, t ? 6 : 8);
    const finds: Item[] = [];
    if (term) {
      const enc = encodeURIComponent(term);
      if (can("orders.view") || can("orders.view_assigned")) finds.push({ id: "find:orders", label: `Orders matching “${term}”`, hint: "Order number, name, email or phone", href: `/orders?q=${enc}`, icon: ShoppingBag });
      if (can("products.view")) finds.push({ id: "find:products", label: `Products matching “${term}”`, hint: "Name or SKU", href: `/products?q=${enc}`, icon: Package });
      if (can("customers.view")) finds.push({ id: "find:customers", label: `Customers matching “${term}”`, hint: "Name, email or phone", href: `/customers?q=${enc}`, icon: UserRound });
      // An order number goes straight to the orders search first.
      if (/^ord-/i.test(term)) finds.sort((a) => (a.id === "find:orders" ? -1 : 1));
    }
    return [...finds, ...matched];
  }, [term, pages, can]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    setQ("");
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(1, items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[active]);
    }
  }

  return (
    <div ref={box} className="relative w-full max-w-xl">
      <div
        className={cn(
          "flex h-10 items-center gap-2 rounded-xl border bg-background px-3 shadow-card transition-colors",
          open ? "border-primary/30 ring-4 ring-primary/10" : "border-border/80 hover:border-primary/30",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={input}
          type="text"
          inputMode="search"
          role="combobox"
          aria-label="Search pages, orders, products and customers"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Search pages, orders, products, customers…"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground sm:inline">Ctrl K</kbd>
      </div>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-dropdown">
          {!term && <li className="px-3 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Go to</li>}
          {items.map((it, i) => (
            <li
              key={it.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault();
                go(it);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", i === active ? "bg-primary/5 text-primary" : "hover:bg-muted")}
            >
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", it.id.startsWith("find:") ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                <it.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{it.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{it.hint}</span>
              </span>
              {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
