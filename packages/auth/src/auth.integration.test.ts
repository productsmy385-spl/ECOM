/**
 * Integration tests against the real test database (ecom_test).
 * Clerk proves who someone is; these tests cover how that identity is mapped to
 * our users table: first sign-in creates a customer (never staff), invited staff
 * are linked by verified email and keep their roles, unverified emails and closed
 * accounts are refused, and suspended users resolve but stay inactive.
 */
import { customerProfiles, db, roles, userRoles, users } from "@ecom/db";
import { can, SUPER_ADMIN } from "@ecom/rbac";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasAnyRole, loadActor } from "./actor";
import { type ClerkIdentity, resolveClerkUser, syncIdentity, unlinkClerkUser } from "./identity";

const run = `t${Date.now()}`;
const email = (n: string) => `${n}.${run}@example.test`;
const cid = (n: string) => `user_${n}_${run}`;
const identity = (n: string, over: Partial<ClerkIdentity> = {}): ClerkIdentity => ({
  clerkUserId: cid(n),
  email: email(n),
  emailVerified: true,
  name: `Test ${n}`,
  image: null,
  ...over,
});

async function cleanup() {
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
}

beforeAll(cleanup);
afterAll(cleanup);

describe("first sign-in", () => {
  it("creates a customer with a profile and no roles", async () => {
    const u = await resolveClerkUser(cid("asha"), async () => identity("asha"));
    expect(u?.email).toBe(email("asha"));
    expect(u?.status).toBe("active");
    const [profile] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, u!.id));
    expect(profile).toBeDefined();
    const [row] = await db.select().from(users).where(eq(users.id, u!.id));
    expect(row!.isStaff).toBe(false);
    expect(await hasAnyRole(u!.id)).toBe(false);
  });

  it("does not call Clerk again once linked", async () => {
    const fetch = vi.fn(async () => identity("asha"));
    const u = await resolveClerkUser(cid("asha"), fetch);
    expect(u?.email).toBe(email("asha"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses an unverified email (no row is created or linked)", async () => {
    const u = await resolveClerkUser(cid("eve"), async () => identity("eve", { emailVerified: false }));
    expect(u).toBeNull();
    const rows = await db.select().from(users).where(eq(users.email, email("eve")));
    expect(rows).toHaveLength(0);
  });

  it("refuses an identity that doesn't match the session's Clerk user", async () => {
    const u = await resolveClerkUser(cid("mallory"), async () => identity("victim"));
    expect(u).toBeNull();
  });
});

describe("invited staff", () => {
  it("links the pre-created staff row by verified email and keeps its roles", async () => {
    const [superAdmin] = await db.select().from(roles).where(eq(roles.key, SUPER_ADMIN));
    const [staff] = await db
      .insert(users)
      .values({ name: "Invited Owner", email: email("owner"), isStaff: true })
      .returning();
    await db.insert(userRoles).values({ userId: staff!.id, roleId: superAdmin!.id });

    // Clerk may report the address with different casing.
    const u = await resolveClerkUser(cid("owner"), async () =>
      identity("owner", { email: email("owner").toUpperCase(), name: "Someone Else" }),
    );
    expect(u?.id).toBe(staff!.id);
    expect(u?.name).toBe("Invited Owner"); // our record wins over the Clerk profile name
    const actor = await loadActor(u!.id);
    expect(can(actor!, "staff.manage")).toBe(true);
  });
});

describe("account state", () => {
  it("resolves a suspended user as suspended, and loadActor refuses them", async () => {
    const u = await resolveClerkUser(cid("sus"), async () => identity("sus"));
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, u!.id));
    const again = await resolveClerkUser(cid("sus"), async () => identity("sus"));
    expect(again?.status).toBe("suspended");
    expect(await loadActor(u!.id)).toBeNull();
  });

  it("never resurrects a closed (soft-deleted) account", async () => {
    await db.insert(users).values({ name: "Closed", email: email("closed"), deletedAt: new Date() });
    const u = await resolveClerkUser(cid("closed"), async () => identity("closed"));
    expect(u).toBeNull();
  });

  it("syncs profile changes and unlinks deleted Clerk users", async () => {
    await syncIdentity(identity("asha", { name: "Asha Rao", image: "https://img.example/a.png" }));
    const [row] = await db.select().from(users).where(eq(users.clerkUserId, cid("asha")));
    expect(row!.name).toBe("Asha Rao");
    expect(row!.image).toBe("https://img.example/a.png");

    await unlinkClerkUser(cid("asha"));
    const [after] = await db.select().from(users).where(eq(users.id, row!.id));
    expect(after!.clerkUserId).toBeNull();
    expect(after!.email).toBe(email("asha")); // history (orders, addresses) stays attached
  });
});
