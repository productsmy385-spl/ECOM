"use client";

import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Item = { id: string; type: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** In-app notifications for the signed-in staff member (refreshes every minute). */
export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ items: Item[]; unread: number }>("/notifications"), refetchInterval: 60_000 });

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function markRead(ids?: string[]) {
    await api("/notifications", { method: "POST", body: ids ? { ids } : {} }).catch(() => {});
    await qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const unread = q.data?.unread ?? 0;
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="true" aria-expanded={open} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} className={cn("relative", className)}>
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-dropdown">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={() => markRead()} className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {(q.data?.items ?? []).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={async () => {
                    setOpen(false);
                    if (!n.readAt) await markRead([n.id]);
                    if (n.link) router.push(n.link);
                  }}
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-muted", !n.readAt && "bg-primary/5")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-0.5 block text-2xs text-muted-foreground">{ago(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
            {q.data && q.data.items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
