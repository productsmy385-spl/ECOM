import {
  accounts,
  type DbOrTx,
  db,
  roles,
  sessions,
  staffProfiles,
  userRoles,
  users,
} from "@ecom/db";
import {
  assertCanAssignRole,
  assertCanManageTarget,
  type Permission,
  requirePermission,
  SUPER_ADMIN,
} from "@ecom/rbac";
import {
  type Paginated,
  staffCreateSchema,
  staffListQuery,
  staffStatusSchema,
  staffUpdateSchema,
} from "@ecom/validation";
import { and, asc, count, desc, eq, exists, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { AuthorizationError, ConflictError, NotFoundError, uniqueViolation, ValidationError } from "./errors";
import { loadRoles, type RoleWithPermissions } from "./roles";

export interface StaffRoleRef {
  id: string;
  key: string;
  name: string;
}

export interface StaffListItem {
  id: string;
  name: string;
  email: string;
  status: "active" | "suspended";
  designation: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: StaffRoleRef[];
}

export interface StaffDetail extends StaffListItem {
  phone: string | null;
  employeeCode: string | null;
  /** False until the invited person sets a password. */
  hasPassword: boolean;
  permissions: Permission[];
}

const NEW_USER = "__new__";

// ------------------------------------------------------------------ reads

async function rolesForUsers(conn: DbOrTx, userIds: string[]) {
  if (!userIds.length) return new Map<string, StaffRoleRef[]>();
  const rows = await conn
    .select({ userId: userRoles.userId, id: roles.id, key: roles.key, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(inArray(userRoles.userId, userIds))
    .orderBy(asc(roles.name));
  const map = new Map<string, StaffRoleRef[]>();
  for (const r of rows) {
    if (!map.has(r.userId)) map.set(r.userId, []);
    map.get(r.userId)!.push({ id: r.id, key: r.key, name: r.name });
  }
  return map;
}

export async function listStaff(ctx: ServiceContext, raw: unknown): Promise<Paginated<StaffListItem>> {
  requirePermission(ctx.actor, "staff.view");
  const q = staffListQuery.parse(raw);

  const filters: SQL[] = [eq(users.isStaff, true), isNull(users.deletedAt)];
  if (q.q) {
    const term = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filters.push(or(ilike(users.name, term), ilike(users.email, term))!);
  }
  if (q.status) filters.push(eq(users.status, q.status));
  if (q.role) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(and(eq(userRoles.userId, users.id), eq(roles.key, q.role))),
      ),
    );
  }
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        designation: staffProfiles.designation,
      })
      .from(users)
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(users).where(where),
  ]);

  const roleMap = await rolesForUsers(db, rows.map((r) => r.id));
  const total = totalRow?.n ?? 0;
  return {
    items: rows.map((r) => ({ ...r, designation: r.designation ?? null, roles: roleMap.get(r.id) ?? [] })),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/** Loads a staff member. Non-staff ids (customers) are reported as 404 — no IDOR leakage. */
async function loadStaff(conn: DbOrTx, id: string): Promise<StaffDetail> {
  const [row] = await conn
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      designation: staffProfiles.designation,
      employeeCode: staffProfiles.employeeCode,
    })
    .from(users)
    .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
    .where(and(eq(users.id, id), eq(users.isStaff, true), isNull(users.deletedAt)))
    .limit(1);
  if (!row) throw new NotFoundError("Staff member not found.");

  const roleRefs = (await rolesForUsers(conn, [id])).get(id) ?? [];
  const roleDetails = await loadRoles(conn, roleRefs.map((r) => r.id));
  const [cred] = await conn
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, id), eq(accounts.providerId, "credential")))
    .limit(1);

  return {
    ...row,
    designation: row.designation ?? null,
    employeeCode: row.employeeCode ?? null,
    roles: roleRefs,
    hasPassword: !!cred,
    permissions: [...new Set(roleDetails.flatMap((r) => r.permissions))],
  };
}

export async function getStaff(ctx: ServiceContext, id: string): Promise<StaffDetail> {
  requirePermission(ctx.actor, "staff.view");
  return loadStaff(db, id);
}

// ----------------------------------------------------------------- writes

async function resolveRoles(conn: DbOrTx, roleIds: string[]): Promise<RoleWithPermissions[]> {
  const unique = [...new Set(roleIds)];
  const found = await loadRoles(conn, unique);
  if (found.length !== unique.length) {
    throw new ValidationError("One or more selected roles no longer exist.", { roleIds: ["Unknown role"] });
  }
  return found;
}

/** Throws if removing super_admin from these users would leave no active Super Admin. */
async function assertSuperAdminRemains(conn: DbOrTx, losingUserId: string) {
  // Lock every Super Admin assignment first. Without this, two Super Admins
  // demoting each other concurrently would each still "see" the other and
  // both succeed, leaving none.
  const holders = await conn
    .select({ userId: userRoles.userId, status: users.status, deletedAt: users.deletedAt })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(eq(roles.key, SUPER_ADMIN))
    .for("update");
  const remaining = holders.filter((h) => h.userId !== losingUserId && h.status === "active" && !h.deletedAt);
  if (remaining.length === 0) throw new ConflictError("At least one active Super Admin must remain.");
}

function auditView(s: StaffDetail) {
  return {
    name: s.name,
    phone: s.phone,
    designation: s.designation,
    employeeCode: s.employeeCode,
    status: s.status,
    roles: s.roles.map((r) => r.key).sort(),
  };
}

/**
 * Creates a staff account WITHOUT a password. The caller then sends an
 * invitation (password-set link); the person chooses their own password.
 */
export async function createStaff(ctx: ServiceContext, raw: unknown): Promise<StaffDetail> {
  requirePermission(ctx.actor, "staff.manage");
  const input = staffCreateSchema.parse(raw);

  return db.transaction(async (tx) => {
    const selected = await resolveRoles(tx, input.roleIds);
    for (const role of selected) assertCanAssignRole(ctx.actor, NEW_USER, role.key, role.permissions);

    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`)
      .limit(1);
    if (existing) {
      throw new ConflictError("An account with this email already exists. Use a different email for staff access.");
    }

    let userId: string;
    try {
      const [u] = await tx
        .insert(users)
        .values({ name: input.name, email: input.email, phone: input.phone ?? null, isStaff: true })
        .returning({ id: users.id });
      userId = u!.id;
      await tx.insert(staffProfiles).values({
        userId,
        designation: input.designation ?? null,
        employeeCode: input.employeeCode ?? null,
      });
    } catch (err) {
      const v = uniqueViolation(err);
      if (v?.constraint?.includes("employee_code")) throw new ConflictError("That employee code is already in use.");
      if (v) throw new ConflictError("An account with this email already exists.");
      throw err;
    }
    await tx
      .insert(userRoles)
      .values(selected.map((r) => ({ userId, roleId: r.id, assignedBy: ctx.actor.userId })));

    const created = await loadStaff(tx, userId);
    await writeAudit(tx, ctx, {
      action: "staff.create",
      entityType: "user",
      entityId: userId,
      after: { email: created.email, ...auditView(created) },
    });
    return created;
  });
}

export async function updateStaff(ctx: ServiceContext, id: string, raw: unknown): Promise<StaffDetail> {
  requirePermission(ctx.actor, "staff.manage");
  const input = staffUpdateSchema.parse(raw);

  return db.transaction(async (tx) => {
    // Serialise concurrent edits of the same person.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).for("update");
    const before = await loadStaff(tx, id);
    const isSelf = id === ctx.actor.userId;
    if (!isSelf) assertCanManageTarget(ctx.actor, before.roles.map((r) => r.key), before.permissions);

    const currentIds = before.roles.map((r) => r.id);
    const nextIds = [...new Set(input.roleIds)];
    const addedIds = nextIds.filter((r) => !currentIds.includes(r));
    const removedIds = currentIds.filter((r) => !nextIds.includes(r));

    if (addedIds.length || removedIds.length) {
      const changed = await resolveRoles(tx, [...addedIds, ...removedIds]);
      // assertCanAssignRole also rejects changing your own roles.
      for (const role of changed) assertCanAssignRole(ctx.actor, id, role.key, role.permissions);
      if (changed.some((r) => removedIds.includes(r.id) && r.key === SUPER_ADMIN)) {
        await assertSuperAdminRemains(tx, id);
      }
      if (removedIds.length) {
        await tx.delete(userRoles).where(and(eq(userRoles.userId, id), inArray(userRoles.roleId, removedIds)));
      }
      if (addedIds.length) {
        await tx.insert(userRoles).values(addedIds.map((roleId) => ({ userId: id, roleId, assignedBy: ctx.actor.userId })));
      }
    }

    try {
      await tx.update(users).set({ name: input.name, phone: input.phone ?? null }).where(eq(users.id, id));
      await tx
        .insert(staffProfiles)
        .values({ userId: id, designation: input.designation ?? null, employeeCode: input.employeeCode ?? null })
        .onConflictDoUpdate({
          target: staffProfiles.userId,
          set: { designation: input.designation ?? null, employeeCode: input.employeeCode ?? null },
        });
    } catch (err) {
      if (uniqueViolation(err)) throw new ConflictError("That employee code is already in use.");
      throw err;
    }

    const after = await loadStaff(tx, id);
    await writeAudit(tx, ctx, {
      action: addedIds.length || removedIds.length ? "staff.update.roles" : "staff.update",
      entityType: "user",
      entityId: id,
      before: auditView(before),
      after: auditView(after),
    });
    return after;
  });
}

/** Activate or deactivate. Deactivation revokes every session immediately. */
export async function setStaffStatus(ctx: ServiceContext, id: string, raw: unknown): Promise<StaffDetail> {
  requirePermission(ctx.actor, "staff.manage");
  const { active } = staffStatusSchema.parse(raw);
  if (id === ctx.actor.userId) throw new AuthorizationError("You cannot change your own account status.");

  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).for("update");
    const before = await loadStaff(tx, id);
    assertCanManageTarget(ctx.actor, before.roles.map((r) => r.key), before.permissions);

    const nextStatus = active ? "active" : "suspended";
    if (before.status === nextStatus) return before;
    if (!active && before.roles.some((r) => r.key === SUPER_ADMIN)) await assertSuperAdminRemains(tx, id);

    await tx.update(users).set({ status: nextStatus }).where(eq(users.id, id));
    await tx.update(staffProfiles).set({ isActive: active }).where(eq(staffProfiles.userId, id));
    let revoked = 0;
    if (!active) {
      revoked = (await tx.delete(sessions).where(eq(sessions.userId, id)).returning({ id: sessions.id })).length;
    }
    await writeAudit(tx, ctx, {
      action: active ? "staff.activate" : "staff.deactivate",
      entityType: "user",
      entityId: id,
      before: { status: before.status },
      after: { status: nextStatus, sessionsRevoked: revoked },
    });
    return { ...before, status: nextStatus };
  });
}

/**
 * Authorises (and audits) re-sending an invitation. The route handler sends the
 * email through Better Auth's password-reset flow after this returns.
 */
export async function prepareStaffInvite(ctx: ServiceContext, id: string): Promise<{ email: string }> {
  requirePermission(ctx.actor, "staff.manage");
  const staff = await loadStaff(db, id);
  if (staff.status !== "active") throw new ConflictError("Activate this staff member before sending an invitation.");
  if (id !== ctx.actor.userId) assertCanManageTarget(ctx.actor, staff.roles.map((r) => r.key), staff.permissions);
  await writeAudit(db, ctx, { action: "staff.invite.send", entityType: "user", entityId: id });
  return { email: staff.email };
}
