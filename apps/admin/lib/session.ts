import "server-only";
import { loadActor } from "@ecom/auth";
import { db, roles } from "@ecom/db";
import { type Actor, can, canAny, isSuperAdmin, type Permission } from "@ecom/rbac";
import { inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { StaffUser } from "@/types";
import { getAuth } from "./auth";

export interface StaffSession {
  user: StaffUser;
  actor: Actor;
}

/**
 * Resolves the signed-in staff member for this request (deduplicated per request).
 * Roles and permissions are always re-read from the database, so a revoked
 * permission takes effect on the next request — not at next login.
 */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  // Read request headers first: this marks the route dynamic before anything else runs.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const actor = await loadActor(session.user.id);
  if (!actor || actor.roles.length === 0) return null;

  const roleRows = actor.roles.length
    ? await db.select({ name: roles.name }).from(roles).where(inArray(roles.key, [...actor.roles]))
    : [];

  return {
    actor,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      roles: [...actor.roles],
      roleNames: roleRows.map((r) => r.name),
      permissions: [...actor.permissions],
      isSuperAdmin: isSuperAdmin(actor),
    },
  };
});

/**
 * Page guard. Call at the top of every admin page (layouts are not re-run on
 * client navigation, so a layout check alone is not enough).
 * - not signed in → /login
 * - signed in without the permission → /forbidden
 */
export async function requireStaff(permission?: Permission): Promise<StaffSession> {
  const s = await getStaffSession();
  if (!s) redirect("/login");
  if (permission && !can(s.actor, permission)) redirect("/forbidden");
  return s;
}

/** Page guard for screens reachable with any one of several permissions. */
export async function requireStaffAny(permissions: Permission[]): Promise<StaffSession> {
  const s = await requireStaff();
  if (!canAny(s.actor, permissions)) redirect("/forbidden");
  return s;
}
