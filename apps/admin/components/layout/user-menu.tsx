"use client";

import { authClient } from "@/lib/auth-client";
import { cn, getInitials } from "@/lib/utils";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShell } from "./shell-context";

export function UserMenu() {
  const { user } = useShell();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const roleLabel = user.roleNames.join(", ") || "Staff";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    const { error } = await authClient.signOut();
    if (error) {
      setSigningOut(false);
      toast.error(error.message ?? "Could not sign out. Please try again.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

  return (
    <div ref={rootRef} className="relative ml-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        className="flex h-9 items-center gap-2 rounded-xl border border-border/80 bg-background px-1 shadow-card transition-colors hover:border-primary/30 hover:bg-primary/5 sm:px-2.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-2xs font-bold text-primary-foreground">
          {getInitials(user.name)}
        </span>
        <span className="hidden text-left md:block">
          <span className="block max-w-[160px] truncate text-xs font-semibold leading-none">{user.name}</span>
          <span className="mt-0.5 flex max-w-[160px] items-center gap-1 truncate text-2xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0 text-success" />
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border bg-card p-1.5 shadow-dropdown"
        >
          <div className="border-b border-border px-2.5 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 truncate text-2xs text-muted-foreground">{roleLabel}</p>
          </div>
          <div className="py-1">
            <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <UserRound className="h-4 w-4 text-muted-foreground" />
              My account
            </Link>
          </div>
          <div className="border-t border-border pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={signingOut}
              className={cn(itemClass, "text-destructive hover:bg-destructive/10 disabled:opacity-60")}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
