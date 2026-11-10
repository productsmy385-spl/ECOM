import { ALL_PERMISSIONS, type Permission } from "./permissions";

export const SUPER_ADMIN = "super_admin" as const;

type RoleDef = { name: string; description: string; permissions: readonly Permission[] };

/**
 * Default system roles. Seeded into the database on first run; afterwards the
 * database is authoritative and Super Admins edit permissions in the matrix UI.
 * Re-running the seed never overwrites edited role permissions.
 */
export const SYSTEM_ROLES = {
  super_admin: {
    name: "Super Admin",
    description: "Full platform access, including roles, permissions and settings.",
    permissions: ALL_PERMISSIONS,
  },
  admin: {
    name: "Admin",
    description: "Runs the store: catalog, orders, customers, inventory, staff.",
    permissions: ALL_PERMISSIONS.filter(
      (p) => !["roles.manage", "permissions.manage", "settings.manage"].includes(p),
    ),
  },
  manager: {
    name: "Manager",
    description: "Monitors operations, manages orders and assigns work.",
    permissions: [
      "dashboard.view",
      "products.view",
      "orders.view",
      "orders.update",
      "orders.cancel",
      "orders.assign",
      "customers.view",
      "inventory.view",
      "designs.view",
      "designs.assign",
      "designs.approve",
      "deliveries.view",
      "deliveries.assign",
      "payments.view",
      "support.view",
      "reports.view",
      "staff.view",
    ],
  },
  designer: {
    name: "Designer",
    description: "Works on assigned customer design requests.",
    permissions: ["dashboard.view", "designs.view_assigned", "designs.create", "designs.update"],
  },
  staff: {
    name: "Staff",
    description: "Handles assigned operational tasks on orders.",
    permissions: ["dashboard.view", "products.view", "orders.view_assigned", "orders.update", "inventory.view"],
  },
  delivery_captain: {
    name: "Delivery Captain",
    description: "Delivers assigned orders and records proof of delivery.",
    permissions: ["deliveries.view_assigned", "deliveries.update_assigned"],
  },
  inventory_manager: {
    name: "Inventory Manager",
    description: "Manages stock, suppliers and purchases.",
    permissions: ["dashboard.view", "products.view", "inventory.view", "inventory.manage", "reports.view"],
  },
  customer_support: {
    name: "Customer Support",
    description: "Handles support tickets and customer questions.",
    permissions: [
      "dashboard.view",
      "customers.view",
      "orders.view",
      "support.view",
      "support.manage",
      "reviews.moderate",
    ],
  },
  finance_manager: {
    name: "Finance Manager",
    description: "Handles payments, refunds and financial reports.",
    permissions: [
      "dashboard.view",
      "orders.view",
      "payments.view",
      "payments.refund",
      "reports.view",
      "reports.export",
    ],
  },
} as const satisfies Record<string, RoleDef>;

export type SystemRoleKey = keyof typeof SYSTEM_ROLES;
