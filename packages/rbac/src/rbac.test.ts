import { describe, expect, it } from "vitest";
import {
  type Actor,
  ALL_PERMISSIONS,
  assertCanAssignRole,
  assertCanEditRolePermissions,
  AuthenticationError,
  AuthorizationError,
  can,
  canAccessAssigned,
  isOwner,
  isPermission,
  type Permission,
  requirePermission,
  SYSTEM_ROLES,
} from "./index";

const actor = (userId: string, roleKey: keyof typeof SYSTEM_ROLES): Actor => ({
  userId,
  roles: [roleKey],
  permissions: new Set<Permission>(SYSTEM_ROLES[roleKey].permissions),
});

describe("permission catalogue", () => {
  it("every system role only references real permissions", () => {
    for (const [key, role] of Object.entries(SYSTEM_ROLES)) {
      for (const p of role.permissions) expect(isPermission(p), `${key} → ${p}`).toBe(true);
    }
  });

  it("super admin holds every permission", () => {
    expect([...SYSTEM_ROLES.super_admin.permissions].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it("admin cannot manage roles, permissions or settings", () => {
    const admin = actor("a", "admin");
    expect(can(admin, "roles.manage")).toBe(false);
    expect(can(admin, "permissions.manage")).toBe(false);
    expect(can(admin, "settings.manage")).toBe(false);
    expect(can(admin, "products.create")).toBe(true);
  });

  it("delivery captain only has assignment-scoped delivery access", () => {
    expect([...SYSTEM_ROLES.delivery_captain.permissions].sort()).toEqual([
      "deliveries.update_assigned",
      "deliveries.view_assigned",
    ]);
  });

  it("designer cannot see all designs, approve, or touch payments", () => {
    const d = actor("d", "designer");
    expect(can(d, "designs.view")).toBe(false);
    expect(can(d, "designs.approve")).toBe(false);
    expect(can(d, "payments.view")).toBe(false);
  });
});

describe("guards", () => {
  it("requirePermission: 401 when anonymous, 403 when lacking", () => {
    expect(() => requirePermission(null, "orders.view")).toThrow(AuthenticationError);
    expect(() => requirePermission(actor("x", "designer"), "orders.view")).toThrow(AuthorizationError);
    expect(requirePermission(actor("x", "manager"), "orders.view").userId).toBe("x");
  });

  it("super_admin role passes any check even if a permission row is missing", () => {
    const sa: Actor = { userId: "s", roles: ["super_admin"], permissions: new Set() };
    expect(can(sa, "settings.manage")).toBe(true);
  });

  it("assignment scope: captains see only their own deliveries", () => {
    const captain = actor("cap-1", "delivery_captain");
    expect(canAccessAssigned(captain, "deliveries.view", "deliveries.view_assigned", "cap-1")).toBe(true);
    expect(canAccessAssigned(captain, "deliveries.view", "deliveries.view_assigned", "cap-2")).toBe(false);
    expect(canAccessAssigned(captain, "deliveries.view", "deliveries.view_assigned", null)).toBe(false);
    const manager = actor("m", "manager");
    expect(canAccessAssigned(manager, "deliveries.view", "deliveries.view_assigned", "cap-2")).toBe(true);
  });

  it("assignment scope: designers see only their own designs", () => {
    const designer = actor("des-1", "designer");
    expect(canAccessAssigned(designer, "designs.view", "designs.view_assigned", "des-1")).toBe(true);
    expect(canAccessAssigned(designer, "designs.view", "designs.view_assigned", "des-2")).toBe(false);
  });

  it("ownership: customers own only their records", () => {
    expect(isOwner("u1", "u1")).toBe(true);
    expect(isOwner("u1", "u2")).toBe(false);
    expect(isOwner(undefined, undefined)).toBe(false);
    expect(isOwner("", "")).toBe(false);
  });
});

describe("privilege escalation", () => {
  const superAdmin = actor("root", "super_admin");
  const admin = actor("adm", "admin");

  it("nobody edits the super_admin role", () => {
    expect(() =>
      assertCanEditRolePermissions(superAdmin, "super_admin", ALL_PERMISSIONS, ["dashboard.view"]),
    ).toThrow(AuthorizationError);
  });

  it("requires permissions.manage to edit roles", () => {
    expect(() => assertCanEditRolePermissions(admin, "staff", [], ["orders.view"])).toThrow(AuthorizationError);
  });

  it("cannot grant a permission the actor does not hold", () => {
    const limited: Actor = {
      userId: "l",
      roles: ["custom"],
      permissions: new Set<Permission>(["permissions.manage", "orders.view"]),
    };
    expect(() => assertCanEditRolePermissions(limited, "staff", [], ["orders.view"])).not.toThrow();
    expect(() => assertCanEditRolePermissions(limited, "staff", [], ["payments.refund"])).toThrow(
      /cannot grant/,
    );
  });

  it("cannot change own roles", () => {
    expect(() =>
      assertCanAssignRole(superAdmin, "root", "admin", SYSTEM_ROLES.admin.permissions),
    ).toThrow(/own roles/);
  });

  it("only a super admin can grant super_admin", () => {
    expect(() =>
      assertCanAssignRole(admin, "other", "super_admin", SYSTEM_ROLES.super_admin.permissions),
    ).toThrow(AuthorizationError);
    expect(() =>
      assertCanAssignRole(superAdmin, "other", "super_admin", SYSTEM_ROLES.super_admin.permissions),
    ).not.toThrow();
  });

  it("cannot assign a role with more access than the actor has", () => {
    expect(() =>
      assertCanAssignRole(admin, "other", "finance_manager", SYSTEM_ROLES.finance_manager.permissions),
    ).not.toThrow();
    const manager = actor("mgr", "manager");
    expect(() =>
      assertCanAssignRole(manager, "other", "designer", SYSTEM_ROLES.designer.permissions),
    ).toThrow(AuthorizationError); // manager lacks staff.manage
  });
});
