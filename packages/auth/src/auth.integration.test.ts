/**
 * Integration tests against the real test database (ecom_test).
 * Covers: customer sign-up, staff-only admin sessions, suspended accounts,
 * server-controlled fields (no self-promotion to staff), and permission loading.
 */
import { db, customerProfiles, roles, userRoles, users } from "@ecom/db";
import { can } from "@ecom/rbac";
import { eq, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadActor } from "./actor";
import { createAuth } from "./server";

const web = createAuth("web");
const admin = createAuth("admin");
const run = `t${Date.now()}`;
const email = (n: string) => `${n}.${run}@example.test`;
const PASSWORD = "Customer#Pass1";

async function cleanup() {
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
}

beforeAll(cleanup);
afterAll(cleanup);

describe("customer auth (web)", () => {
  it("signs up a customer, creates a profile and no roles", async () => {
    const res = await web.api.signUpEmail({ body: { name: "Asha", email: email("asha"), password: PASSWORD } });
    expect(res.user.email).toBe(email("asha"));
    const [profile] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, res.user.id));
    expect(profile).toBeDefined();
    const actor = await loadActor(res.user.id);
    expect(actor?.roles).toEqual([]);
    expect(actor?.permissions.size).toBe(0);
  });

  it("ignores attempts to self-assign server-controlled fields at sign-up", async () => {
    const body = { name: "Mallory", email: email("mallory"), password: PASSWORD, isStaff: true, status: "active" };
    // Better Auth rejects input:false fields outright; either rejection or ignoring is acceptable.
    const attempt = web.api.signUpEmail({ body: body as never }).catch((e: unknown) => e);
    const result = await attempt;
    const [u] = await db.select().from(users).where(eq(users.email, email("mallory")));
    if (u) expect(u.isStaff).toBe(false);
    else expect(result).toBeInstanceOf(Error);
  });

  it("rejects a wrong password without revealing whether the email exists", async () => {
    const wrong = await web.api
      .signInEmail({ body: { email: email("asha"), password: "nope-nope-1" } })
      .catch((e: { status?: string; body?: { message?: string } }) => e);
    const missing = await web.api
      .signInEmail({ body: { email: email("ghost"), password: "nope-nope-1" } })
      .catch((e: { status?: string; body?: { message?: string } }) => e);
    expect((wrong as { body?: { message?: string } }).body?.message).toBe(
      (missing as { body?: { message?: string } }).body?.message,
    );
  });
});

describe("admin auth is staff-only", () => {
  it("refuses an admin session to a customer, even with correct credentials", async () => {
    const err = await admin.api
      .signInEmail({ body: { email: email("asha"), password: PASSWORD } })
      .then(() => null)
      .catch((e: { status?: string }) => e);
    expect(err).not.toBeNull();
    expect((err as { status?: string }).status).toBe("FORBIDDEN");
  });

  it("does not allow sign-up through the admin app", async () => {
    const err = await admin.api
      .signUpEmail({ body: { name: "Eve", email: email("eve"), password: PASSWORD } })
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).not.toBeNull();
    const [u] = await db.select().from(users).where(eq(users.email, email("eve")));
    expect(u).toBeUndefined();
  });

  it("grants an admin session once the user holds a staff role, with exactly that role's permissions", async () => {
    const signUp = await web.api.signUpEmail({ body: { name: "Dev", email: email("designer"), password: PASSWORD } });
    const [designerRole] = await db.select().from(roles).where(eq(roles.key, "designer"));
    await db.insert(userRoles).values({ userId: signUp.user.id, roleId: designerRole!.id });

    const res = await admin.api.signInEmail({ body: { email: email("designer"), password: PASSWORD } });
    expect(res.user.id).toBe(signUp.user.id);

    const actor = await loadActor(signUp.user.id);
    expect(actor?.roles).toEqual(["designer"]);
    expect(can(actor, "designs.view_assigned")).toBe(true);
    expect(can(actor, "designs.view")).toBe(false);
    expect(can(actor, "orders.view")).toBe(false);
  });

  it("seeded super admin can sign in and holds every permission", async () => {
    const res = await admin.api.signInEmail({ body: { email: "root@test.local", password: "RootPassword#123" } });
    const actor = await loadActor(res.user.id);
    expect(actor?.roles).toContain("super_admin");
    expect(can(actor, "permissions.manage")).toBe(true);
  });
});

describe("suspended accounts", () => {
  it("cannot sign in to either app, and loadActor returns null", async () => {
    const res = await web.api.signUpEmail({ body: { name: "Sam", email: email("sam"), password: PASSWORD } });
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, res.user.id));

    for (const app of [web, admin]) {
      const err = await app.api
        .signInEmail({ body: { email: email("sam"), password: PASSWORD } })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(err).not.toBeNull();
    }
    expect(await loadActor(res.user.id)).toBeNull();
  });
});

describe("email uniqueness", () => {
  it("is case-insensitive at the database level", async () => {
    await expect(
      db.execute(
        sql`insert into users (name, email) values ('Dup', ${email("asha").toUpperCase()})`,
      ),
    ).rejects.toThrow();
  });
});
