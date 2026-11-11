import type { Permission } from "@ecom/rbac";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Boxes, ClipboardList, CreditCard, Factory, FolderTree, KeyRound, LayoutDashboard, Package, Palette, ScrollText, Settings, ShieldCheck, ShoppingBag, Tags, TicketPercent, Truck, UserRound, Users, Bike } from "lucide-react";

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
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, anyOf: ["dashboard.view"] },
      { title: "My work", href: "/workspace", icon: ClipboardList },
      { title: "Reports", href: "/reports", icon: BarChart3, anyOf: ["reports.view"] },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Orders", href: "/orders", icon: ShoppingBag, anyOf: ["orders.view", "orders.view_assigned"] },
      { title: "Payments", href: "/payments", icon: CreditCard, anyOf: ["payments.view"] },
      { title: "Customers", href: "/customers", icon: UserRound, anyOf: ["customers.view"] },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", href: "/products", icon: Package, anyOf: ["products.view"] },
      { title: "Categories", href: "/categories", icon: FolderTree, anyOf: ["categories.manage", "products.view"] },
      { title: "Brands", href: "/brands", icon: Tags, anyOf: ["categories.manage", "products.view"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Designs", href: "/designs", icon: Palette, anyOf: ["designs.view", "designs.view_assigned"] },
      { title: "Deliveries", href: "/deliveries", icon: Bike, anyOf: ["deliveries.view", "deliveries.view_assigned"] },
      { title: "Inventory", href: "/inventory", icon: Boxes, anyOf: ["inventory.view"] },
      { title: "Purchases", href: "/purchases", icon: Truck, anyOf: ["inventory.view"] },
      { title: "Suppliers", href: "/suppliers", icon: Factory, anyOf: ["inventory.view"] },
    ],
  },
  {
    label: "Marketing",
    items: [{ title: "Coupons", href: "/coupons", icon: TicketPercent, anyOf: ["marketing.manage"] }],
  },
  {
    label: "Administration",
    items: [
      { title: "Staff", href: "/staff", icon: Users, anyOf: ["staff.view"] },
      { title: "Roles", href: "/roles", icon: ShieldCheck, anyOf: ["roles.manage", "permissions.manage", "staff.view"] },
      { title: "Permissions", href: "/permissions", icon: KeyRound, anyOf: ["permissions.manage", "roles.manage"] },
      { title: "Audit Logs", href: "/audit-logs", icon: ScrollText, anyOf: ["audit_logs.view"] },
      { title: "Checkout settings", href: "/settings/checkout", icon: Settings, anyOf: ["settings.manage"] },
    ],
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
