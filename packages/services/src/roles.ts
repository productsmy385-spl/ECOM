import { type DbOrTx, db, permissions, rolePermissions, roles, userRoles, users } from "@ecom/db";
import {
  assertCanEditRolePermissions,
  canAny,
  isPermission,
  type Permission,
  PERMISSIONS,
  requirePermission,
  SUPER_ADMIN,
} from "@ecom/rbac";
import { roleCreateSchema, rolePermissionsSchema, roleUpdateSchema } from "@ecom/validation";
import { and, asc, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { AuthorizationError, ConflictError, NotFoundError } from "./errors";

export interface RoleWithPermissions {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
}

export interface RoleSummary extends RoleWithPermissions {
  userCount: number;
}

/** Internal loader (no permission check) — used by staff and role services. */
export async function loadRoles(conn: DbOrTx, ids?: string[]): Promise<RoleWithPermissions[]> {
  if (ids && ids.length === 0) return [];
  const rows = await conn
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
      permissionKey: permissions.key,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(ids ? inArray(roles.id, ids) : undefined)
    .orderBy(asc(roles.createdAt));

  const map = new Map<string, RoleWithPermissions>();
  for (const r of rows) {
    let role = map.get(r.id);
    if (!role) {
      role = { id: r.id, key: r.key, name: r.name, description: r.description, isSystem: r.isSystem, permissions: [] };
      map.set(r.id, role);
    }
    if (r.permissionKey && isPermission(r.permissionKey)) role.permissions.push(r.permissionKey);
  }
  return [...map.values()];
}

/** Roles + user counts. Visible to anyone who manages staff, roles or permissions. */
export async function listRoles(ctx: ServiceContext): Promise<RoleSummary[]> {
  if (!canAny(ctx.actor, ["staff.view", "staff.manage", "roles.manage", "permissions.manage"])) {
    throw new AuthorizationError();
  }
  const [list, counts] = await Promise.all([
    loadRoles(db),
    db
      .select({ roleId: userRoles.roleId, n: count() })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(isNull(users.deletedAt))
      .groupBy(userRoles.roleId),
  ]);
  const byRole = new Map(counts.map((c) => [c.roleId, c.n]));
  // Super Admin first, then system roles, then custom roles.
  return list
    .map((r) => ({ ...r, userCount: byRole.get(r.id) ?? 0 }))
    .sort((a, b) => Number(b.key === SUPER_ADMIN) - Number(a.key === SUPER_ADMIN) || Number(b.isSystem) - Number(a.isSystem));
}

/** The permission catalogue grouped by module (for the matrix). */
export function listPermissionCatalogue(ctx: ServiceContext) {
  if (!canAny(ctx.actor, ["roles.manage", "permissions.manage", "staff.manage"])) throw new AuthorizationError();
  const groups = new Map<string, { key: Permission; description: string }[]>();
  for (const [key, meta] of Object.entries(PERMISSIONS) as [Permission, { module: string; description: string }][]) {
    if (!groups.has(meta.module)) groups.set(meta.module, []);
    groups.get(meta.module)!.push({ key, description: meta.description });
  }
  return [...groups.entries()].map(([module, perms]) => ({ module, permissions: perms }));
}

function slugKey(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 56) || "role"
  );
}

export async function createRole(ctx: ServiceContext, raw: unknown): Promise<RoleSummary> {
  requirePermission(ctx.actor, "roles.manage");
  const input = roleCreateSchema.parse(raw);
  const base = slugKey(input.name);

  return db.transaction(async (tx) => {
    // Find a free key: base, base_2, base_3...
    const taken = new Set(
      (await tx.select({ key: roles.key }).from(roles)).map((r) => r.key),
    );
    let key = base;
    for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
    await assertNameFree(tx, input.name);

    const [role] = await tx
      .insert(roles)
      .values({ key, name: input.name, description: input.description ?? null, isSystem: false })
      .returning();
    await writeAudit(tx, ctx, { action: "role.create", entityType: "role", entityId: role!.id, after: { key, name: input.name, description: input.description ?? null } });
    return { id: role!.id, key, name: role!.name, description: role!.description, isSystem: false, permissions: [], userCount: 0 };
  });
}

/** Role names are unique case-insensitively so the staff role picker is unambiguous. */
async function assertNameFree(conn: DbOrTx, name: string, exceptId?: string) {
  const [clash] = await conn
    .select({ id: roles.id })
    .from(roles)
    .where(and(sql`lower(${roles.name}) = lower(${name})`, exceptId ? ne(roles.id, exceptId) : undefined))
    .limit(1);
  if (clash) throw new ConflictError("A role with that name already exists.");
}

async function getRoleOr404(conn: DbOrTx, id: string): Promise<RoleWithPermissions> {
  const [role] = await loadRoles(conn, [id]);
  if (!role) throw new NotFoundError("Role not found.");
  return role;
}

export async function updateRole(ctx: ServiceContext, id: string, raw: unknown): Promise<RoleWithPermissions> {
  requirePermission(ctx.actor, "roles.manage");
  const input = roleUpdateSchema.parse(raw);
  return db.transaction(async (tx) => {
    const role = await getRoleOr404(tx, id);
    if (role.key === SUPER_ADMIN) throw new AuthorizationError("The Super Admin role cannot be modified.");
    await assertNameFree(tx, input.name, id);
    await tx.update(roles).set({ name: input.name, description: input.description ?? null }).where(eq(roles.id, id));
    await writeAudit(tx, ctx, {
      action: "role.update",
      entityType: "role",
      entityId: id,
      before: { name: role.name, description: role.description },
      after: { name: input.name, description: input.description ?? null },
    });
    return { ...role, name: input.name, description: input.description ?? null };
  });
}

export async function deleteRole(ctx: ServiceContext, id: string): Promise<void> {
  requirePermission(ctx.actor, "roles.manage");
  await db.transaction(async (tx) => {
    const role = await getRoleOr404(tx, id);
    if (role.isSystem) throw new ConflictError("System roles cannot be deleted.");
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(userRoles).where(eq(userRoles.roleId, id));
    if (n > 0) {
      throw new ConflictError(`This role is assigned to ${n} staff member${n === 1 ? "" : "s"}. Reassign them first.`);
    }
    await tx.delete(roles).where(eq(roles.id, id));
    await writeAudit(tx, ctx, {
      action: "role.delete",
      entityType: "role",
      entityId: id,
      before: { key: role.key, name: role.name, permissions: role.permissions },
    });
  });
}

/**
 * Replace a role's permission set. Escalation-safe: the actor can only grant
 * permissions they hold, and the Super Admin role is immutable.
 */
export async function setRolePermissions(ctx: ServiceContext, id: string, raw: unknown): Promise<RoleWithPermissions> {
  requirePermission(ctx.actor, "permissions.manage");
  const { permissions: next } = rolePermissionsSchema.parse(raw);

  return db.transaction(async (tx) => {
    // Lock the role row so two concurrent matrix saves serialise.
    await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, id)).for("update");
    const role = await getRoleOr404(tx, id);
    assertCanEditRolePermissions(ctx.actor, role.key, role.permissions, next);

    const added = next.filter((p) => !role.permissions.includes(p));
    const removed = role.permissions.filter((p) => !next.includes(p));
    if (added.length === 0 && removed.length === 0) return role;

    const permRows = await tx
      .select({ id: permissions.id, key: permissions.key })
      .from(permissions)
      .where(inArray(permissions.key, [...added, ...removed]));
    const idOf = new Map(permRows.map((p) => [p.key, p.id]));

    if (removed.length) {
      await tx
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, id), inArray(rolePermissions.permissionId, removed.map((k) => idOf.get(k)!))));
    }
    if (added.length) {
      const missing = added.filter((k) => !idOf.has(k));
      if (missing.length) throw new ConflictError(`Permissions not seeded yet: ${missing.join(", ")}. Run the seed.`);
      await tx.insert(rolePermissions).values(added.map((k) => ({ roleId: id, permissionId: idOf.get(k)! })));
    }
    await writeAudit(tx, ctx, {
      action: "role.permissions.update",
      entityType: "role",
      entityId: id,
      before: { permissions: role.permissions },
      after: { permissions: next, added, removed },
    });
    return { ...role, permissions: next };
  });
}
