"use client";

import { filterNavigation, navigation as allNavigation, type NavGroup } from "@/config/navigation";
import type { StaffUser } from "@/types";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ShellState {
  user: StaffUser;
  navigation: NavGroup[];
  /** Mobile drawer (below lg). */
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  /** Desktop icon-only rail. Persisted per browser. */
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  can: (permission: string) => boolean;
}

const ShellContext = createContext<ShellState | null>(null);
/** Read by the server layout so the first paint already has the right width (no flash). */
export const SIDEBAR_COOKIE = "admin_sidebar_collapsed";

export function ShellProvider({
  user,
  initialCollapsed,
  children,
}: {
  user: StaffUser;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  // Filtered here (not in the server layout) because nav items hold icon
  // components, which cannot cross the server→client boundary.
  const navigation = useMemo(
    () => filterNavigation(allNavigation, new Set(user.permissions), user.isSuperAdmin),
    [user.permissions, user.isSuperAdmin],
  );
  const [isOpen, setOpen] = useState(false);
  const [isCollapsed, setCollapsed] = useState(initialCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? "0" : "1"}; path=/admin; max-age=31536000; samesite=lax`;
      return !c;
    });
  }, []);

  const value = useMemo<ShellState>(() => {
    const perms = new Set(user.permissions);
    return {
      user,
      navigation,
      isOpen,
      setOpen,
      isCollapsed,
      toggleCollapsed,
      // UI hint only; the server enforces every permission.
      can: (p) => user.isSuperAdmin || perms.has(p),
    };
  }, [user, navigation, isOpen, isCollapsed, toggleCollapsed]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside <ShellProvider>");
  return ctx;
}
