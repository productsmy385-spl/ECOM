import { ESCALATION_PERMISSIONS, type Permission } from "./permissions";
import { SUPER_ADMIN } from "./roles";

/** The authorization context resolved server-side from the verified session. */
export interface Actor {
  userId: string;
  roles: readonly string[];
  permissions: ReadonlySet<Permission>;
}

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  readonly status = 401;
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export const isSuperAdmin = (actor: Actor) => actor.roles.includes(SUPER_ADMIN);

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  return isSuperAdmin(actor) || actor.permissions.has(permission);
}

export function canAny(actor: Actor | null | undefined, permissions: readonly Permission[]) {
  return permissions.some((p) => can(actor, p));
}

export function requirePermission(actor: Actor | null | undefined, permission: Permission): Actor {
  if (!actor) throw new AuthenticationError();
  if (!can(actor, permission)) throw new AuthorizationError();
  return actor;
}

/**
 * Record-level check for assignment-scoped resources (designs, deliveries,
 * operational orders). Grants access when the actor holds the global
 * permission, or holds the `_assigned` variant and is the assignee.
 * Returns false (not throws) so callers can respond 404 to avoid leaking
 * the existence of records the actor may not see (IDOR protection).
 */
export function canAccessAssigned(
  actor: Actor | null | undefined,
  globalPermission: Permission,
  assignedPermission: Permission,
  assigneeId: string | null | undefined,
): boolean {
  if (!actor) return false;
  if (can(actor, globalPermission)) return true;
  return can(actor, assignedPermission) && !!assigneeId && assigneeId === actor.userId;
}

/** Customers may only touch records they own. */
export function isOwner(actorUserId: string | null | undefined, ownerId: string | null | undefined) {
  return !!actorUserId && !!ownerId && actorUserId === ownerId;
}

// ------------------------------------------------- privilege escalation

/**
 * May `actor` set a role's permissions to `nextPermissions`?
 * - needs permissions.manage
 * - may never edit the super_admin role (it always has everything)
 * - may only grant permissions the actor itself holds (no escalation)
 */
export function assertCanEditRolePermissions(
  actor: Actor,
  roleKey: string,
  currentPermissions: readonly Permission[],
  nextPermissions: readonly Permission[],
): void {
  requirePermission(actor, "permissions.manage");
  if (roleKey === SUPER_ADMIN) throw new AuthorizationError("The Super Admin role cannot be modified.");
  const added = nextPermissions.filter((p) => !currentPermissions.includes(p));
  const notHeld = added.filter((p) => !can(actor, p));
  if (notHeld.length) {
    throw new AuthorizationError(`You cannot grant permissions you do not hold: ${notHeld.join(", ")}`);
  }
}

/**
 * May `actor` assign/remove `roleKey` (with `rolePermissions`) to/from `targetUserId`?
 * - needs staff.manage
 * - nobody changes their own roles (prevents self-escalation and lock-out)
 * - only a Super Admin can grant or revoke super_admin
 * - only grant roles whose permissions are a subset of the actor's
 */
export function assertCanAssignRole(
  actor: Actor,
  targetUserId: string,
  roleKey: string,
  rolePermissions: readonly Permission[],
): void {
  requirePermission(actor, "staff.manage");
  if (targetUserId === actor.userId) throw new AuthorizationError("You cannot change your own roles.");
  if (roleKey === SUPER_ADMIN && !isSuperAdmin(actor)) {
    throw new AuthorizationError("Only a Super Admin can manage the Super Admin role.");
  }
  const notHeld = rolePermissions.filter((p) => !can(actor, p));
  if (notHeld.length) {
    throw new AuthorizationError("You cannot assign a role with more access than your own.");
  }
}

/**
 * May `actor` edit or deactivate a staff member who holds `targetRoles` / `targetPermissions`?
 * - nobody but a Super Admin manages a Super Admin
 * - nobody manages someone with access the actor does not have (no "power over the powerful")
 */
export function assertCanManageTarget(
  actor: Actor,
  targetRoles: readonly string[],
  targetPermissions: readonly Permission[],
): void {
  requirePermission(actor, "staff.manage");
  if (targetRoles.includes(SUPER_ADMIN) && !isSuperAdmin(actor)) {
    throw new AuthorizationError("Only a Super Admin can manage another Super Admin.");
  }
  if (targetPermissions.some((p) => !can(actor, p))) {
    throw new AuthorizationError("You cannot manage a staff member who has more access than you.");
  }
}

/** Escalation-capable permissions held by a role (for UI warnings and audit emphasis). */
export function escalationPermissionsIn(perms: readonly Permission[]) {
  return perms.filter((p) => ESCALATION_PERMISSIONS.includes(p));
}
