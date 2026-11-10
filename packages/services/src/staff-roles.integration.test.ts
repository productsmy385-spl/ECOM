/**
 * Integration tests for staff, role and permission management against ecom_test.
 * Proves: permission enforcement, privilege-escalation guards, last-Super-Admin
 * protection, session revocation, IDOR (customers invisible), audit writes,
 * and the end-to-end invitation → set password → sign-in flow.
 */
import { createAuth, loadActor } from "@ecom/auth";
import { auditLogs, db, roles, sessions, userRoles, users, verifications } from "@ecom/db";
import { AuthorizationError, type Actor } from "@ecom/rbac";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ConflictError,
  createRole,
  createStaff,
  deleteRole,
  getStaff,
  listAuditLogs,
  listStaff,
  NotFoundError,
  setRolePermissions,
  setStaffStatus,
  updateRole,
  updateStaff,
} from "./index";

const run = `s${Date.now()}`;
const mail = (n: string) => `${n}.${run}@example.test`;
const roleName = (n: string) => `${n} ${run}`;

async function roleId(key: string) {
  const [r] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
  return r!.id;
}

async function makeUser(name: string, roleKeys: string[], isStaff = true) {
  const [u] = await db
    .insert(users)
    .values({ name, email: mail(name.toLowerCase()), isStaff })
    .returning({ id: users.id });
  for (const k of roleKeys) await db.insert(userRoles).values({ userId: u!.id, roleId: await roleId(k) });
  return u!.id;
}

const ctxOf = async (userId: string) => ({ actor: (await loadActor(userId)) as Actor, ip: "127.0.0.1", userAgent: "vitest" });

let rootId: string;
let superB: string;
let admin: string;
let manager: string;
let designer: string;
let customer: string;

beforeAll(async () => {
  const [root] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  rootId = root!.id;
  superB = await makeUser("SuperB", ["super_admin"]);
  admin = await makeUser("Admin", ["admin"]);
  manager = await makeUser("Manager", ["manager"]);
  designer = await makeUser("Designer", ["designer"]);
  customer = await makeUser("Customer", [], false);
});

afterAll(async () => {
  // Restore root's Super Admin role if a test removed it.
  await db.insert(userRoles).values({ userId: rootId, roleId: await roleId("super_admin") }).onConflictDoNothing();
  await db.update(users).set({ status: "active" }).where(eq(users.id, rootId));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
  await db.delete(roles).where(like(roles.name, `% ${run}`));
});

describe("staff creation", () => {
  it("creates a staff member without a password, with roles and an audit row", async () => {
    const ctx = await ctxOf(rootId);
    const staff = await createStaff(ctx, {
      name: "Priya",
      email: mail("PRIYA"),
      phone: "98765 43210",
      designation: "Designer",
      roleIds: [await roleId("designer")],
    });
    expect(staff.email).toBe(mail("priya")); // normalised to lower case
    expect(staff.phone).toBe("+919876543210");
    expect(staff.hasPassword).toBe(false);
    expect(staff.roles.map((r) => r.key)).toEqual(["designer"]);
    expect(staff.permissions).toContain("designs.view_assigned");

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "staff.create"), eq(auditLogs.entityId, staff.id)));
    expect(log?.actorId).toBe(rootId);
  });

  it("rejects a duplicate email (case-insensitive)", async () => {
    const ctx = await ctxOf(rootId);
    await expect(
      createStaff(ctx, { name: "Dup", email: mail("Priya"), roleIds: [await roleId("staff")] }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("returns field errors for invalid input", async () => {
    const ctx = await ctxOf(rootId);
    await expect(createStaff(ctx, { name: "", email: "nope", roleIds: [] })).rejects.toMatchObject({
      name: "ZodError",
    });
  });

  it("needs staff.manage", async () => {
    await expect(
      createStaff(await ctxOf(manager), { name: "X", email: mail("x1"), roleIds: [await roleId("staff")] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("an Admin cannot create a Super Admin", async () => {
    await expect(
      createStaff(await ctxOf(admin), { name: "Evil", email: mail("evil"), roleIds: [await roleId("super_admin")] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("invitation flow", () => {
  it("invite link sets a password, verifies the email and allows admin sign-in", async () => {
    const auth = createAuth("admin");
    const staff = await createStaff(await ctxOf(rootId), {
      name: "Invitee",
      email: mail("invitee"),
      roleIds: [await roleId("staff")],
    });
    await auth.api.requestPasswordReset({ body: { email: staff.email, redirectTo: "/admin/reset-password" } });

    const [v] = await db
      .select({ identifier: verifications.identifier })
      .from(verifications)
      .where(and(like(verifications.identifier, "reset-password:%"), eq(verifications.value, staff.id)));
    const token = v!.identifier.slice("reset-password:".length);

    await auth.api.resetPassword({ body: { token, newPassword: "Invited#Pass123" } });
    const signIn = await auth.api.signInEmail({ body: { email: staff.email, password: "Invited#Pass123" } });
    expect(signIn.user.id).toBe(staff.id);

    const detail = await getStaff(await ctxOf(rootId), staff.id);
    expect(detail.hasPassword).toBe(true);
    const [u] = await db.select({ v: users.emailVerified }).from(users).where(eq(users.id, staff.id));
    expect(u?.v).toBe(true);

    // The token is single-use.
    await expect(auth.api.resetPassword({ body: { token, newPassword: "Another#Pass123" } })).rejects.toBeTruthy();
  });
});

describe("staff updates and escalation", () => {
  it("nobody changes their own roles, but may edit their own name", async () => {
    const ctx = await ctxOf(admin);
    await expect(
      updateStaff(ctx, admin, { name: "Admin", roleIds: [await roleId("admin"), await roleId("finance_manager")] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    const updated = await updateStaff(ctx, admin, { name: "Admin Renamed", roleIds: [await roleId("admin")] });
    expect(updated.name).toBe("Admin Renamed");
  });

  it("an Admin cannot edit or deactivate a Super Admin", async () => {
    const ctx = await ctxOf(admin);
    await expect(
      updateStaff(ctx, superB, { name: "Hacked", roleIds: [await roleId("super_admin")] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(setStaffStatus(ctx, superB, { active: false })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("an Admin can change a designer's roles and the change is audited with before/after", async () => {
    const ctx = await ctxOf(admin);
    const after = await updateStaff(ctx, designer, {
      name: "Designer",
      roleIds: [await roleId("designer"), await roleId("staff")],
    });
    expect(after.roles.map((r) => r.key).sort()).toEqual(["designer", "staff"]);
    const [log] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "staff.update.roles"), eq(auditLogs.entityId, designer)));
    expect((log?.before as { roles: string[] }).roles).toEqual(["designer"]);
    expect((log?.after as { roles: string[] }).roles).toEqual(["designer", "staff"]);
  });

  it("the last active Super Admin cannot be demoted", async () => {
    // SuperB removes root's Super Admin role (allowed: SuperB remains)...
    const ctxB = await ctxOf(superB);
    await updateStaff(ctxB, rootId, { name: "Root Admin", roleIds: [await roleId("admin")] });
    // ...then a stale root actor tries to demote SuperB, who is now the last one.
    const staleRoot = { actor: { userId: rootId, roles: ["super_admin"], permissions: new Set() } as Actor };
    await expect(
      updateStaff(staleRoot, superB, { name: "SuperB", roleIds: [await roleId("admin")] }),
    ).rejects.toBeInstanceOf(ConflictError);
    // Restore.
    await updateStaff(ctxB, rootId, { name: "Root Admin", roleIds: [await roleId("super_admin")] });
  });

  it("deactivation revokes sessions immediately and blocks the actor", async () => {
    await db.insert(sessions).values({
      userId: designer,
      token: `tok-${run}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const ctx = await ctxOf(admin);
    await expect(setStaffStatus(ctx, admin, { active: false })).rejects.toBeInstanceOf(AuthorizationError); // self
    const res = await setStaffStatus(ctx, designer, { active: false });
    expect(res.status).toBe("suspended");
    const left = await db.select().from(sessions).where(eq(sessions.userId, designer));
    expect(left).toHaveLength(0);
    expect(await loadActor(designer)).toBeNull();
    await setStaffStatus(ctx, designer, { active: true });
  });
});

describe("data isolation", () => {
  it("customers are invisible to staff management (404, not listed)", async () => {
    const ctx = await ctxOf(rootId);
    await expect(getStaff(ctx, customer)).rejects.toBeInstanceOf(NotFoundError);
    const list = await listStaff(ctx, { q: run, pageSize: 100 });
    expect(list.items.map((i) => i.id)).not.toContain(customer);
    expect(list.items.length).toBeGreaterThan(0);
  });

  it("a designer cannot list staff or read audit logs", async () => {
    const ctx = await ctxOf(designer);
    await expect(listStaff(ctx, {})).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listAuditLogs(ctx, {})).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("roles and the permission matrix", () => {
  it("creates, renames and deletes a custom role; names are unique case-insensitively", async () => {
    const ctx = await ctxOf(rootId);
    const role = await createRole(ctx, { name: roleName("Packer"), description: "Packs orders" });
    expect(role.key.startsWith("packer_")).toBe(true);
    await expect(createRole(ctx, { name: roleName("PACKER") })).rejects.toBeInstanceOf(ConflictError);
    const renamed = await updateRole(ctx, role.id, { name: roleName("Packing Staff") });
    expect(renamed.name).toBe(roleName("Packing Staff"));
    await deleteRole(ctx, role.id);
    const gone = await db.select().from(roles).where(eq(roles.id, role.id));
    expect(gone).toHaveLength(0);
  });

  it("system roles cannot be deleted; roles in use cannot be deleted", async () => {
    const ctx = await ctxOf(rootId);
    await expect(deleteRole(ctx, await roleId("designer"))).rejects.toBeInstanceOf(ConflictError);
    const role = await createRole(ctx, { name: roleName("Temp") });
    await db.insert(userRoles).values({ userId: manager, roleId: role.id });
    await expect(deleteRole(ctx, role.id)).rejects.toThrow(/assigned to 1 staff member/);
    await db.delete(userRoles).where(and(eq(userRoles.userId, manager), eq(userRoles.roleId, role.id)));
    await deleteRole(ctx, role.id);
  });

  it("Admin (no permissions.manage) cannot edit the matrix", async () => {
    const role = await createRole(await ctxOf(rootId), { name: roleName("Matrix A") });
    await expect(
      setRolePermissions(await ctxOf(admin), role.id, { permissions: ["orders.view"] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a permission manager can only grant permissions they hold", async () => {
    const rootCtx = await ctxOf(rootId);
    const editorRole = await createRole(rootCtx, { name: roleName("Matrix Editor") });
    await setRolePermissions(rootCtx, editorRole.id, { permissions: ["permissions.manage", "orders.view"] });
    const editor = await makeUser("Editor", []);
    await db.insert(userRoles).values({ userId: editor, roleId: editorRole.id });

    const target = await createRole(rootCtx, { name: roleName("Matrix Target") });
    const ctx = await ctxOf(editor);
    const ok = await setRolePermissions(ctx, target.id, { permissions: ["orders.view"] });
    expect(ok.permissions).toEqual(["orders.view"]);
    await expect(
      setRolePermissions(ctx, target.id, { permissions: ["orders.view", "payments.refund"] }),
    ).rejects.toThrow(/cannot grant/);

    const [log] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "role.permissions.update"), eq(auditLogs.entityId, target.id)));
    expect((log?.after as { added: string[] }).added).toEqual(["orders.view"]);
  });

  it("the Super Admin role is immutable, even for a Super Admin", async () => {
    await expect(
      setRolePermissions(await ctxOf(rootId), await roleId("super_admin"), { permissions: [] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("rejects unknown permission keys", async () => {
    const role = await createRole(await ctxOf(rootId), { name: roleName("Unknown Perm") });
    await expect(
      setRolePermissions(await ctxOf(rootId), role.id, { permissions: ["orders.view", "everything.do"] }),
    ).rejects.toMatchObject({ name: "ZodError" });
  });
});

describe("audit log", () => {
  it("lists entries newest first with actor details, filterable by action", async () => {
    const page = await listAuditLogs(await ctxOf(rootId), { action: "staff.create", pageSize: 5 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((i) => i.action === "staff.create")).toBe(true);
    expect(page.items[0]!.actor?.email).toBeDefined();
    const times = page.items.map((i) => i.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("writes no audit row for a denied action", async () => {
    const before = await db.select({ n: sql<number>`count(*)::int` }).from(auditLogs);
    await createStaff(await ctxOf(manager), { name: "Nope", email: mail("nope"), roleIds: [await roleId("staff")] }).catch(() => {});
    const after = await db.select({ n: sql<number>`count(*)::int` }).from(auditLogs);
    expect(after[0]!.n).toBe(before[0]!.n);
    const created = await db.select().from(users).where(inArray(users.email, [mail("nope")]));
    expect(created).toHaveLength(0);
  });
});
