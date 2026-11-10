import { db, permissions, rolePermissions, roles, userRoles, users } from "@ecom/db";
import { type Actor, isPermission, type Permission } from "@ecom/rbac";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Resolves roles and permissions for a user from the database. Always called
 * server-side with the user id taken from the verified session — never from
 * request input.
 */
export async function loadActor(userId: string): Promise<Actor | null> {
  const rows = await db
    .select({ roleKey: roles.key, permissionKey: permissions.key, status: users.status })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));

  if (rows.length === 0 || rows[0]!.status !== "active") return null;

  const roleKeys = new Set<string>();
  const perms = new Set<Permission>();
  for (const r of rows) {
    if (r.roleKey) roleKeys.add(r.roleKey);
    if (r.permissionKey && isPermission(r.permissionKey)) perms.add(r.permissionKey);
  }
  return { userId, roles: [...roleKeys], permissions: perms };
}

/** True when the user holds at least one role (i.e. is staff). */
export async function hasAnyRole(userId: string): Promise<boolean> {
  const row = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))
    .limit(1);
  return row.length > 0;
}
