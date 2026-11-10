/**
 * Single source of truth for permission keys. The seed script writes these to
 * the `permissions` table; APIs check them with requirePermission().
 *
 * `*_assigned` permissions are record-scoped: they grant access only to records
 * assigned to the acting user (data isolation for designers, staff and
 * delivery captains). The unscoped key grants access to all records.
 */
export const PERMISSIONS = {
  "dashboard.view": { module: "dashboard", description: "View the admin dashboard" },

  "products.view": { module: "products", description: "View products" },
  "products.create": { module: "products", description: "Create products" },
  "products.update": { module: "products", description: "Edit products, variants, images and customization options" },
  "products.delete": { module: "products", description: "Delete products" },
  "products.publish": { module: "products", description: "Publish or unpublish products" },
  "categories.manage": { module: "products", description: "Manage categories and brands" },

  "orders.view": { module: "orders", description: "View all orders" },
  "orders.view_assigned": { module: "orders", description: "View orders assigned to me" },
  "orders.create": { module: "orders", description: "Create orders on behalf of customers" },
  "orders.update": { module: "orders", description: "Update order status and notes" },
  "orders.cancel": { module: "orders", description: "Cancel orders" },
  "orders.assign": { module: "orders", description: "Assign staff to orders" },

  "customers.view": { module: "customers", description: "View customers" },
  "customers.update": { module: "customers", description: "Edit or suspend customers" },

  "inventory.view": { module: "inventory", description: "View stock, suppliers and purchases" },
  "inventory.manage": { module: "inventory", description: "Adjust stock, manage suppliers and purchases" },

  "designs.view": { module: "designs", description: "View all customer designs" },
  "designs.view_assigned": { module: "designs", description: "View designs assigned to me" },
  "designs.create": { module: "designs", description: "Upload design versions and previews" },
  "designs.update": { module: "designs", description: "Update design progress and notes" },
  "designs.assign": { module: "designs", description: "Assign designers to designs" },
  "designs.approve": { module: "designs", description: "Give final approval for production" },

  "deliveries.view": { module: "deliveries", description: "View all deliveries" },
  "deliveries.view_assigned": { module: "deliveries", description: "View deliveries assigned to me" },
  "deliveries.assign": { module: "deliveries", description: "Assign delivery captains" },
  "deliveries.update": { module: "deliveries", description: "Update any delivery" },
  "deliveries.update_assigned": { module: "deliveries", description: "Update deliveries assigned to me" },

  "payments.view": { module: "payments", description: "View payments and refunds" },
  "payments.refund": { module: "payments", description: "Issue refunds" },

  "support.view": { module: "support", description: "View support tickets" },
  "support.manage": { module: "support", description: "Reply to and update support tickets" },
  "reviews.moderate": { module: "support", description: "Approve or reject product reviews" },

  "marketing.manage": { module: "marketing", description: "Manage coupons, banners and newsletter" },

  "reports.view": { module: "reports", description: "View reports" },
  "reports.export": { module: "reports", description: "Export reports" },

  "staff.view": { module: "staff", description: "View staff members" },
  "staff.manage": { module: "staff", description: "Invite, edit and deactivate staff; assign roles" },
  "roles.manage": { module: "staff", description: "Create, edit and delete roles" },
  "permissions.manage": { module: "staff", description: "Change role permissions" },

  "settings.manage": { module: "settings", description: "Manage system settings" },
  "audit_logs.view": { module: "settings", description: "View audit logs" },
} as const satisfies Record<string, { module: string; description: string }>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value);
}

/** Permissions that let a holder change who can do what. Guarded extra-strictly. */
export const ESCALATION_PERMISSIONS: readonly Permission[] = [
  "roles.manage",
  "permissions.manage",
  "staff.manage",
  "settings.manage",
];
