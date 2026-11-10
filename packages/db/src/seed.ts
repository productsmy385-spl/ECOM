/**
 * Idempotent bootstrap seed. Safe to run repeatedly, including in production:
 *  - permissions: inserted/updated from @ecom/rbac (code is the source of truth for keys)
 *  - system roles: created once with default permissions; later runs do NOT
 *    overwrite permissions a Super Admin has edited — except super_admin, which
 *    always receives every permission
 *  - categories and system settings: inserted only if missing
 *  - first Super Admin: created only if SEED_SUPERADMIN_EMAIL does not exist yet
 * Contains no demo products, orders or customers.
 */
import { ALL_PERMISSIONS, PERMISSIONS, SUPER_ADMIN, SYSTEM_ROLES } from "@ecom/rbac";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { createDb } from "./client";
import {
  accounts,
  categories,
  permissions,
  rolePermissions,
  roles,
  staffProfiles,
  systemSettings,
  userRoles,
  users,
} from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[seed] DATABASE_URL is not set");
  process.exit(1);
}
const { db, pool } = createDb(url, 2);

const CATEGORIES = [
  { name: "Cosmetics", slug: "cosmetics", isCustomizable: false },
  { name: "Customized Cosmetics", slug: "customized-cosmetics", isCustomizable: true },
  { name: "Eyeglass Frames", slug: "eyeglass-frames", isCustomizable: true },
  { name: "Sunglasses", slug: "sunglasses", isCustomizable: true },
  { name: "Designer Frames", slug: "designer-frames", isCustomizable: true },
  { name: "Premium Frames", slug: "premium-frames", isCustomizable: true },
  { name: "Accessories", slug: "accessories", isCustomizable: false },
  { name: "Customized Accessories", slug: "customized-accessories", isCustomizable: true },
];

const SETTINGS: { key: string; value: unknown; description: string }[] = [
  { key: "checkout.guest_enabled", value: true, description: "Allow checkout without an account" },
  { key: "checkout.cod_enabled", value: false, description: "Offer cash on delivery" },
  { key: "checkout.cod_max_amount", value: 500000, description: "Max order total (paise) eligible for COD" },
  { key: "shipping.free_threshold", value: 99900, description: "Order subtotal (paise) above which standard shipping is free" },
  { key: "shipping.standard_fee", value: 4900, description: "Standard shipping fee (paise)" },
  { key: "shipping.express_fee", value: 14900, description: "Express shipping fee (paise)" },
  { key: "shipping.standard_days", value: [4, 7], description: "Standard delivery estimate range (days)" },
  { key: "shipping.express_days", value: [1, 3], description: "Express delivery estimate range (days)" },
  { key: "inventory.reserve_on", value: "order_placed", description: "When stock is reserved: order_placed | payment_captured" },
  { key: "inventory.payment_hold_minutes", value: 30, description: "Release unpaid reservations after N minutes" },
  { key: "auth.customer_otp_enabled", value: true, description: "Allow customers to sign in with an email OTP" },
  { key: "store.gstin", value: "", description: "GSTIN printed on invoices" },
  { key: "store.address", value: "", description: "Registered address printed on invoices" },
];

async function main() {
  await db.transaction(async (tx) => {
    // 1. Permissions — upsert from code.
    for (const key of ALL_PERMISSIONS) {
      const { module, description } = PERMISSIONS[key];
      await tx
        .insert(permissions)
        .values({ key, module, description })
        .onConflictDoUpdate({ target: permissions.key, set: { module, description } });
    }
    const permRows = await tx.select({ id: permissions.id, key: permissions.key }).from(permissions);
    const permId = new Map(permRows.map((p) => [p.key, p.id]));

    // 2. System roles — create if missing, grant defaults only on creation.
    for (const [key, def] of Object.entries(SYSTEM_ROLES)) {
      const inserted = await tx
        .insert(roles)
        .values({ key, name: def.name, description: def.description, isSystem: true })
        .onConflictDoNothing({ target: roles.key })
        .returning({ id: roles.id });
      const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
      const grant = inserted.length > 0 || key === SUPER_ADMIN ? def.permissions : [];
      if (grant.length) {
        await tx
          .insert(rolePermissions)
          .values(grant.map((p) => ({ roleId: role!.id, permissionId: permId.get(p)! })))
          .onConflictDoNothing();
      }
    }

    // 3. Categories.
    await tx
      .insert(categories)
      .values(CATEGORIES.map((c, i) => ({ ...c, sortOrder: i, isFeatured: true })))
      .onConflictDoNothing({ target: categories.slug });

    // 4. Settings.
    await tx.insert(systemSettings).values(SETTINGS).onConflictDoNothing({ target: systemSettings.key });
  });

  // 5. First Super Admin.
  const email = process.env.SEED_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (email && password) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`);
    if (existing.length === 0) {
      if (password.length < 12 && process.env.NODE_ENV === "production") {
        throw new Error("SEED_SUPERADMIN_PASSWORD must be at least 12 characters in production");
      }
      await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(users)
          .values({
            name: process.env.SEED_SUPERADMIN_NAME ?? "Super Admin",
            email,
            emailVerified: true,
            isStaff: true,
          })
          .returning({ id: users.id });
        await tx.insert(accounts).values({
          userId: u!.id,
          accountId: u!.id,
          providerId: "credential",
          password: await hashPassword(password),
        });
        await tx.insert(staffProfiles).values({ userId: u!.id, designation: "Owner" });
        const [r] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, SUPER_ADMIN));
        await tx.insert(userRoles).values({ userId: u!.id, roleId: r!.id });
      });
      console.log(`[seed] created Super Admin ${email} — change the password after first login`);
    } else {
      console.log(`[seed] Super Admin ${email} already exists — unchanged`);
    }
  } else {
    console.log("[seed] SEED_SUPERADMIN_EMAIL/PASSWORD not set — skipped Super Admin");
  }

  const roleCount = await db.select({ n: sql<number>`count(*)::int` }).from(roles);
  const catCount = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(categories)
    .where(inArray(categories.slug, CATEGORIES.map((c) => c.slug)));
  console.log(
    `[seed] done: ${ALL_PERMISSIONS.length} permissions, ${roleCount[0]!.n} roles, ${catCount[0]!.n} categories, ${SETTINGS.length} settings`,
  );
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
