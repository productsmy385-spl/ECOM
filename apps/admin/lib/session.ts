import "server-only";
import { type AppUser, fetchClerkIdentity, loadActor, resolveClerkUser } from "@ecom/auth";
import { db, roles } from "@ecom/db";
import { type Actor, can, canAny, isSuperAdmin, type Permission } from "@ecom/rbac";
import { auth } from "@clerk/nextjs/server";
import { inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { StaffUser } from "@/types";

export interface StaffSession {
  user: StaffUser;
  actor: Actor;
}

export type AdminAuthState =
  | { kind: "signed-out" }
  /** Signed in with Clerk, but not an active staff member (customer, suspended, unverified email). */
  | { kind: "no-access" }
  | { kind: "staff"; session: StaffSession };

/** Our users row for the signed-in Clerk user (linked on first sign-in), or null. */
const getAppUser = cache(async (): Promise<{ clerkUserId: string | null; user: AppUser | null }> => {
  // auth() reads request headers, so every page using this renders dynamically.
  const { userId } = await auth();
  if (!userId) return { clerkUserId: null, user: null };
  return { clerkUserId: userId, user: await resolveClerkUser(userId, () => fetchClerkIdentity(userId)) };
});

/**
 * Resolves the signed-in staff member for this request (deduplicated per request).
 * Clerk proves identity; roles and permissions are always re-read from our
 * database, so a revoked permission or a suspension takes effect on the next
 * request, not at next login.
 */
export const getAdminAuthState = cache(async (): Promise<AdminAuthState> => {
  const { clerkUserId, user } = await getAppUser();
  if (!clerkUserId) return { kind: "signed-out" };
  if (!user || user.status !== "active") return { kind: "no-access" };
  const actor = await loadActor(user.id);
  if (!actor || actor.roles.length === 0) return { kind: "no-access" };

  const roleRows = await db.select({ name: roles.name }).from(roles).where(inArray(roles.key, [...actor.roles]));
  return {
    kind: "staff",
    session: {
      actor,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        roles: [...actor.roles],
        roleNames: roleRows.map((r) => r.name),
        permissions: [...actor.permissions],
        isSuperAdmin: isSuperAdmin(actor),
      },
    },
  };
});

export async function getStaffSession(): Promise<StaffSession | null> {
  const s = await getAdminAuthState();
  return s.kind === "staff" ? s.session : null;
}

/**
 * Page guard. Call at the top of every admin page (layouts are not re-run on
 * client navigation, so a layout check alone is not enough).
 * - not signed in → /login
 * - signed in but not active staff → /no-access
 * - staff without the permission → /forbidden
 */
export async function requireStaff(permission?: Permission): Promise<StaffSession> {
  const s = await getAdminAuthState();
  if (s.kind === "signed-out") redirect("/login");
  if (s.kind === "no-access") redirect("/no-access");
  if (permission && !can(s.session.actor, permission)) redirect("/forbidden");
  return s.session;
}

/** Page guard for screens reachable with any one of several permissions. */
export async function requireStaffAny(permissions: Permission[]): Promise<StaffSession> {
  const s = await requireStaff();
  if (!canAny(s.actor, permissions)) redirect("/forbidden");
  return s;
}
