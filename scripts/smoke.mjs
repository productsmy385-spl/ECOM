#!/usr/bin/env node
/**
 * End-to-end HTTP smoke test against running apps (local or deployed).
 *   node scripts/smoke.mjs
 * Env: WEB_URL, ADMIN_URL (origin, no /admin), CLERK_SECRET_KEY (development
 * instance), SMOKE_STAFF_EMAIL (a Super Admin who has signed in with Clerk at
 * least once). Without SMOKE_STAFF_EMAIL the staff checks are skipped.
 *
 * Signed-in requests use short-lived Clerk session tokens sent as
 * `Authorization: Bearer`, minted through Clerk's Backend API. The script
 * creates one throwaway Clerk customer (smoke-<ts>+clerk_test@example.com) and
 * deletes that Clerk user at the end.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

if (existsSync(".env")) process.loadEnvFile(".env");
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const STAFF_EMAIL = process.env.SMOKE_STAFF_EMAIL;
const { createClerkClient } = createRequire(new URL("../packages/auth/package.json", import.meta.url))("@clerk/backend");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};
const skip = (name, why) => console.log(`SKIP  ${name}  (${why})`);

/** A fresh 10-minute session token for a Clerk user. */
async function tokenFor(clerkUserId) {
  const session = await clerk.sessions.createSession({ userId: clerkUserId });
  const { jwt } = await clerk.sessions.getToken(session.id, undefined, 600);
  return { jwt, sessionId: session.id };
}
const authz = (token) => (token ? { Authorization: `Bearer ${token}` } : {});

async function post(base, path, body, { origin = base, token, method = "POST" } = {}) {
  return fetch(base + path, {
    method,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: origin, ...authz(token) },
    body: JSON.stringify(body),
  });
}
const get = (url, token) => fetch(url, { redirect: "manual", headers: authz(token) });
// 1. Health
for (const [name, url] of [["web", `${WEB}/api/health`], ["admin", `${ADMIN}/admin/api/health`]]) {
  const r = await get(url);
  const j = await r.json().catch(() => ({}));
  check(`${name} health`, r.status === 200 && j.database?.ok === true, `HTTP ${r.status}`);
}

// 2. Storefront renders live categories
{
  const r = await get(`${WEB}/`);
  const html = await r.text();
  check("storefront home renders DB categories", r.status === 200 && html.includes("Eyeglass Frames"));
}

// 3. Signed-out protection
{
  const r = await get(`${ADMIN}/admin/dashboard`);
  check("dashboard redirects anonymous users to login", [302, 303, 307].includes(r.status) &&
    (r.headers.get("location") ?? "").includes("/admin/login"), `HTTP ${r.status} → ${r.headers.get("location")}`);
  const a = await get(`${WEB}/account`);
  check("storefront account redirects anonymous users to login", [302, 303, 307].includes(a.status) &&
    (a.headers.get("location") ?? "").includes("/login?next="), `HTTP ${a.status}`);
  const api = await get(`${WEB}/api/account/addresses`);
  check("customer API rejects anonymous requests", api.status === 401, `HTTP ${api.status}`);
  const staffApi = await get(`${ADMIN}/admin/api/staff`);
  check("staff API rejects anonymous requests", staffApi.status === 401, `HTTP ${staffApi.status}`);
  const wh = await post(WEB, "/api/webhooks/clerk", { type: "user.updated", data: { id: "user_x" } });
  check("Clerk webhook refuses unsigned payloads", wh.status === 400 || wh.status === 503, `HTTP ${wh.status}`);
}

// 4. Customer (throwaway Clerk user) — storefront works, admin refuses
const custEmail = `smoke-${Date.now().toString(36)}+clerk_test@example.com`;
let custClerkId = null;
let customerId = null;
try {
  const u = await clerk.users.createUser({ emailAddress: [custEmail], firstName: "Smoke", lastName: "Customer", skipPasswordRequirement: true });
  custClerkId = u.id;
  const { jwt } = await tokenFor(u.id);
  const acc = await get(`${WEB}/api/account/addresses`, jwt);
  check("customer is provisioned on first request and can use the account API", acc.status === 200, `HTTP ${acc.status}`);
  const profile = await (await get(`${WEB}/api/account/profile`, jwt)).json().catch(() => ({}));
  customerId = profile.id ?? null;
  check("customer profile is linked to the Clerk email", profile.email === custEmail.toLowerCase(), profile.email);
  const cross = await post(WEB, "/api/account/addresses", {}, { origin: "https://evil.example", token: jwt });
  check("cross-origin customer write is rejected", cross.status === 403, `HTTP ${cross.status}`);
  const adm = await get(`${ADMIN}/admin/dashboard`, jwt);
  check("customer gets no admin access (→ /no-access)", [302, 303, 307].includes(adm.status) &&
    (adm.headers.get("location") ?? "").includes("/admin/no-access"), `HTTP ${adm.status} → ${adm.headers.get("location")}`);
  const admApi = await get(`${ADMIN}/admin/api/staff`, jwt);
  check("customer is refused by the staff API", admApi.status === 401, `HTTP ${admApi.status}`);
} catch (err) {
  check("customer session via Clerk Backend API", false, err.message);
}

// 5. Staff (needs SMOKE_STAFF_EMAIL with a Clerk account)
let staffToken = null;
if (!STAFF_EMAIL) {
  skip("staff checks", "SMOKE_STAFF_EMAIL not set");
} else {
  const { data } = await clerk.users.getUserList({ emailAddress: [STAFF_EMAIL] });
  if (!data[0]) skip("staff checks", `${STAFF_EMAIL} has no Clerk account yet`);
  else staffToken = (await tokenFor(data[0].id)).jwt;
}

if (staffToken) {
  const d = await get(`${ADMIN}/admin/dashboard`, staffToken);
  const html = await d.text();
  check("signed-in staff sees the dashboard", d.status === 200 && html.includes("Welcome"), `HTTP ${d.status}`);
  check("DataDropX licence credit is visible", html.includes("datadropx.net"));

  const list = await get(`${ADMIN}/admin/api/staff`, staffToken);
  const body = await list.json().catch(() => ({}));
  check("staff API lists staff for a signed-in Super Admin", list.status === 200 && Array.isArray(body.items), `HTTP ${list.status}`);

  const cross = await post(ADMIN, "/admin/api/roles", { name: "Evil role" }, { origin: "https://evil.example", token: staffToken });
  check("cross-origin API write is rejected", cross.status === 403, `HTTP ${cross.status}`);

  const invalid = await post(ADMIN, "/admin/api/staff", { name: "", email: "bad", roleIds: [] }, { token: staffToken });
  const inv = await invalid.json().catch(() => ({}));
  check("invalid staff input returns 422 with field errors", invalid.status === 422 && !!inv.fieldErrors?.email, `HTTP ${invalid.status}`);

  const bogus = await get(`${ADMIN}/admin/api/staff/not-a-uuid`, staffToken);
  check("malformed ids return 404", bogus.status === 404, `HTTP ${bogus.status}`);

  if (customerId) {
    const idor = await get(`${ADMIN}/admin/api/staff/${customerId}`, staffToken);
    check("customer records are not reachable via the staff API (404)", idor.status === 404, `HTTP ${idor.status}`);
  } else check("customer records are not reachable via the staff API (404)", false, "could not resolve customer id");
}
// 6. Staff creation sends a Clerk invitation
if (staffToken) {
  const roles = await (await get(`${ADMIN}/admin/api/roles`, staffToken)).json();
  const staffRole = roles.find?.((r) => r.key === "staff");
  const inviteEmail = `smoke-staff-${Date.now().toString(36)}+clerk_test@example.com`;
  const created = await post(ADMIN, "/admin/api/staff", { name: "Smoke Staff", email: inviteEmail, roleIds: [staffRole?.id] }, { token: staffToken });
  const cj = await created.json().catch(() => ({}));
  check("Super Admin can create staff and a Clerk invitation is sent", created.status === 201 && cj.invite?.sent === true && cj.staff?.hasJoined === false, `HTTP ${created.status} ${JSON.stringify(cj.invite)}`);
  const audit = await (await get(`${ADMIN}/admin/api/audit-logs?action=staff.create&pageSize=1`, staffToken)).json();
  check("staff creation is in the audit log", audit.items?.[0]?.entityId === cj.staff?.id);
  // Withdraw the smoke invitation again.
  const { data: invs } = await clerk.invitations.getInvitationList({ status: "pending", query: inviteEmail });
  for (const i of invs) await clerk.invitations.revokeInvitation(i.id);
}
// 7. Catalogue end-to-end (Phase 3): admin creates → draft hidden → publish → storefront → delete
if (staffToken) {
  const anon = await get(`${ADMIN}/admin/api/products`);
  check("product API rejects anonymous requests", anon.status === 401, `HTTP ${anon.status}`);

  const opts = await (await get(`${ADMIN}/admin/api/products/options`, staffToken)).json();
  const categoryId = opts.categories?.[0]?.id;
  const tag = `Smoke ${Date.now().toString(36)}`;
  const created = await post(
    ADMIN,
    "/admin/api/products",
    {
      name: `${tag} Frame`,
      categoryId,
      taxRateBps: 1200,
      variants: [{ sku: `SMOKE-${Date.now().toString(36)}`.toUpperCase(), name: "Std", price: 123400, initialStock: 3 }],
    },
    { token: staffToken },
  );
  const product = await created.json().catch(() => ({}));
  check("staff can create a product (draft)", created.status === 201 && product.status === "draft", `HTTP ${created.status}`);

  const hidden = await get(`${WEB}/products/${product.slug}`);
  check("draft product is not visible in the store (404)", hidden.status === 404, `HTTP ${hidden.status}`);

  const pub = await post(ADMIN, `/admin/api/products/${product.id}/status`, { status: "published" }, { token: staffToken });
  check("product can be published", pub.status === 200, `HTTP ${pub.status}`);

  const page = await get(`${WEB}/products/${product.slug}`);
  const html = await page.text();
  check("published product page renders with price", page.status === 200 && html.includes("1,234"), `HTTP ${page.status}`);

  const search = await (await get(`${WEB}/shop?q=${encodeURIComponent(tag)}`)).text();
  check("published product is found by storefront search", search.includes(`${tag} Frame`));

  const api = await (await get(`${WEB}/api/products/${product.slug}`)).json();
  check("public product API exposes availability, not stock counts", !!api.variants?.[0]?.availability && !("onHand" in (api.variants?.[0] ?? {})));

  const del = await fetch(`${ADMIN}/admin/api/products/${product.id}`, { method: "DELETE", headers: { Origin: ADMIN, ...authz(staffToken) } });
  const gone = await get(`${WEB}/products/${product.slug}`);
  check("deleted product disappears from the store", del.status === 200 && gone.status === 404, `HTTP ${del.status}/${gone.status}`);

  const ik = await get(`${ADMIN}/admin/api/uploads/imagekit-auth`, staffToken);
  check("image upload signing responds (503 = not configured yet, 200 = configured)", ik.status === 503 || ik.status === 200, `HTTP ${ik.status}`);

  const crossNl = await post(WEB, "/api/newsletter", { email: "x@example.test" }, { origin: "https://evil.example" });
  check("newsletter rejects cross-origin posts", crossNl.status === 403, `HTTP ${crossNl.status}`);
  const badNl = await post(WEB, "/api/newsletter", { email: "not-an-email" });
  check("newsletter validates the email", badNl.status === 422, `HTTP ${badNl.status}`);
  const missing = await get(`${WEB}/api/products/no-such-product`);
  check("unknown product returns 404", missing.status === 404, `HTTP ${missing.status}`);
}

// 8. Clean up the throwaway Clerk customer (our users row stays, unlinked, like any deleted Clerk user)
if (custClerkId) await clerk.users.deleteUser(custClerkId).catch(() => {});

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}  (throwaway customer: ${custEmail})`);
process.exit(failures === 0 ? 0 : 1);