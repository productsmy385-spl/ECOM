import { customerProfiles, db, users } from "@ecom/db";
import { eq, sql } from "drizzle-orm";

/** The parts of a Clerk user we rely on. Built server-side from Clerk's API, never from request input. */
export interface ClerkIdentity {
  clerkUserId: string;
  /** Primary email address. */
  email: string | null;
  /** True only when Clerk has verified the primary email. */
  emailVerified: boolean;
  name: string | null;
  image: string | null;
}

export interface AppUser {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  status: "active" | "suspended";
}

const userColumns = {
  id: users.id,
  clerkUserId: users.clerkUserId,
  name: users.name,
  email: users.email,
  emailVerified: users.emailVerified,
  image: users.image,
  status: users.status,
  deletedAt: users.deletedAt,
  lastLoginAt: users.lastLoginAt,
};

type Row = { [K in keyof typeof userColumns]: unknown } & {
  id: string;
  clerkUserId: string | null;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  status: "active" | "suspended";
  deletedAt: Date | null;
  lastLoginAt: Date | null;
};

const LOGIN_TOUCH_MS = 60 * 60 * 1000;

function toAppUser(r: Row): AppUser | null {
  if (r.deletedAt || !r.clerkUserId) return null;
  return {
    id: r.id,
    clerkUserId: r.clerkUserId,
    name: r.name,
    email: r.email,
    emailVerified: r.emailVerified,
    image: r.image,
    status: r.status,
  };
}

async function touchLogin(r: Row) {
  if (!r.lastLoginAt || Date.now() - r.lastLoginAt.getTime() > LOGIN_TOUCH_MS) {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, r.id));
  }
}

/**
 * Maps a signed-in Clerk user to our `users` row.
 *
 * - Already linked (by clerk_user_id): returned directly. `fetchIdentity` is not
 *   called, so the common path costs one indexed query and no Clerk API call.
 * - Not linked yet: Clerk is asked for the user, and the row with the same
 *   **verified** email is linked to it. This is how invited staff, and accounts
 *   that existed before Clerk, take over their roles, addresses and orders.
 * - No row with that email: a customer row is created (never staff; staff
 *   access only comes from roles granted in the admin).
 *
 * Returns null for unverified emails, closed (soft-deleted) accounts, and when
 * Clerk has no such user. Callers must still check `status`.
 */
export async function resolveClerkUser(
  clerkUserId: string,
  fetchIdentity: () => Promise<ClerkIdentity | null>,
): Promise<AppUser | null> {
  const [linked] = (await db.select(userColumns).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1)) as Row[];
  if (linked) {
    const u = toAppUser(linked);
    if (u?.status === "active") await touchLogin(linked);
    return u;
  }

  const identity = await fetchIdentity();
  if (!identity || identity.clerkUserId !== clerkUserId) return null;
  return provisionFromIdentity(identity);
}

/** Links or creates the `users` row for a Clerk identity. Exported for tests and the webhook. */
export async function provisionFromIdentity(identity: ClerkIdentity): Promise<AppUser | null> {
  const email = identity.email?.trim().toLowerCase();
  // Linking by email is only safe when Clerk has proven the person owns it.
  if (!email || !identity.emailVerified) return null;

  return db.transaction(async (tx) => {
    const [existing] = (await tx
      .select(userColumns)
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .for("update")
      .limit(1)) as Row[];

    if (existing) {
      if (existing.deletedAt) return null; // closed account: never resurrect silently
      if (existing.clerkUserId && existing.clerkUserId !== identity.clerkUserId) {
        // The previous Clerk user for this verified email was deleted and recreated.
        console.warn(`[auth] relinking user ${existing.id} to a new Clerk user`);
      }
      const [row] = (await tx
        .update(users)
        .set({
          clerkUserId: identity.clerkUserId,
          emailVerified: true,
          image: existing.image ?? identity.image,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning(userColumns)) as Row[];
      return toAppUser(row!);
    }

    const name = identity.name?.trim() || email.split("@")[0]!;
    const [row] = (await tx
      .insert(users)
      .values({
        clerkUserId: identity.clerkUserId,
        name,
        email,
        emailVerified: true,
        image: identity.image,
        lastLoginAt: new Date(),
      })
      .returning(userColumns)) as Row[];
    await tx.insert(customerProfiles).values({ userId: row!.id }).onConflictDoNothing();
    return toAppUser(row!);
  });
}

/** Keeps name/email/image in step with Clerk (webhook `user.updated`). Never changes roles or status. */
export async function syncIdentity(identity: ClerkIdentity): Promise<void> {
  const email = identity.email?.trim().toLowerCase();
  const set: Partial<typeof users.$inferInsert> = { image: identity.image };
  if (identity.name?.trim()) set.name = identity.name.trim();
  if (email && identity.emailVerified) {
    set.email = email;
    set.emailVerified = true;
  }
  try {
    await db.update(users).set(set).where(eq(users.clerkUserId, identity.clerkUserId));
  } catch (err) {
    // Another account already uses the new email: keep the old one rather than fail the webhook.
    if ((err as { code?: string }).code === "23505") {
      delete set.email;
      await db.update(users).set(set).where(eq(users.clerkUserId, identity.clerkUserId));
      return;
    }
    throw err;
  }
}

/** Clerk user deleted (webhook `user.deleted`): unlink so the row keeps its history but can't sign in. */
export async function unlinkClerkUser(clerkUserId: string): Promise<void> {
  await db.update(users).set({ clerkUserId: null }).where(eq(users.clerkUserId, clerkUserId));
}
