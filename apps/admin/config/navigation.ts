import type { Permission } from "@ecom/rbac";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  badge?: string | number;
  /** Shown when the user holds ANY of these permissions. Omit = every staff member. */
  anyOf?: Permission[];
  children?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar, breadcrumb and route registry. Only routes that exist are listed —
 * each phase adds its modules here as they ship, so there are no dead links.
 * Hiding an item is a UX nicety only: every page and API enforces its own
 * permission on the server.
 */
export const navigation: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, anyOf: ["dashboard.view"] }],
  },
];

export function filterNavigation(nav: NavGroup[], permissions: ReadonlySet<string>, isSuperAdmin: boolean) {
  const allowed = (item: NavItem) =>
    isSuperAdmin || !item.anyOf || item.anyOf.some((p) => permissions.has(p));
  return nav
    .map((group) => ({
      ...group,
      items: group.items
        .filter(allowed)
        .map((item) => ({ ...item, children: item.children?.filter(allowed) })),
    }))
    .filter((group) => group.items.length > 0);
}
