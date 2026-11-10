#!/usr/bin/env node
/**
 * End-to-end HTTP smoke test against running apps (local or deployed).
 *   node scripts/smoke.mjs
 * Env: WEB_URL, ADMIN_URL (origin, no /admin), SMOKE_STAFF_EMAIL, SMOKE_STAFF_PASSWORD
 * (defaults to SEED_SUPERADMIN_* from the root .env).
 * Creates one throwaway customer: smoke.<timestamp>@example.test
 */
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_URL ?? "http://localhost:3001";
const STAFF_EMAIL = process.env.SMOKE_STAFF_EMAIL ?? process.env.SEED_SUPERADMIN_EMAIL;
const STAFF_PASSWORD = process.env.SMOKE_STAFF_PASSWORD ?? process.env.SEED_SUPERADMIN_PASSWORD;

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

const cookiesFrom = (res) =>
  (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

async function post(base, path, body, { origin = base, cookie } = {}) {
  return fetch(base + path, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}
const get = (url, cookie) => fetch(url, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });

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

// 3. Admin is protected
{
  const r = await get(`${ADMIN}/admin/dashboard`);
  check("dashboard redirects anonymous users to login", [302, 303, 307].includes(r.status) &&
    (r.headers.get("location") ?? "").includes("/admin/login"), `HTTP ${r.status} → ${r.headers.get("location")}`);
}

// 4. Staff sign-in → dashboard
let staffCookie = "";
{
  const r = await post(ADMIN, "/admin/api/auth/sign-in/email", { email: STAFF_EMAIL, password: STAFF_PASSWORD });
  staffCookie = cookiesFrom(r);
  check("staff can sign in to admin", r.status === 200 && staffCookie.includes("ecom_admin"), `HTTP ${r.status}`);
  const d = await get(`${ADMIN}/admin/dashboard`, staffCookie);
  const html = await d.text();
  check("signed-in staff sees the dashboard", d.status === 200 && html.includes("Welcome"), `HTTP ${d.status}`);
  check("DataDropX licence credit is visible", html.includes("datadropx.net"));
}

// 5. Customer sign-up on web; refused by admin
const custEmail = `smoke.${Date.now()}@example.test`;
const custPassword = "Smoke#Customer1";
{
  const r = await post(WEB, "/api/auth/sign-up/email", { name: "Smoke Customer", email: custEmail, password: custPassword });
  const custCookie = cookiesFrom(r);
  check("customer can sign up on the storefront", r.status === 200 && custCookie.includes("ecom."), `HTTP ${r.status}`);

  const a = await post(ADMIN, "/admin/api/auth/sign-in/email", { email: custEmail, password: custPassword });
  check("customer is refused an admin session", a.status === 403 && !cookiesFrom(a).includes("session_token"), `HTTP ${a.status}`);

  const leak = await get(`${ADMIN}/admin/dashboard`, custCookie);
  check("customer storefront cookie does not open admin", [302, 303, 307].includes(leak.status), `HTTP ${leak.status}`);
}

// 6. Cross-site request is rejected (origin check / CSRF)
{
  const r = await post(ADMIN, "/admin/api/auth/sign-in/email", { email: STAFF_EMAIL, password: STAFF_PASSWORD }, { origin: "https://evil.example" });
  check("cross-origin sign-in is rejected", r.status === 403, `HTTP ${r.status}`);
}

// 6b. Admin REST API (Phase 2)
let customerId = null;
{
  const anon = await get(`${ADMIN}/admin/api/staff`);
  check("staff API rejects anonymous requests", anon.status === 401, `HTTP ${anon.status}`);

  const list = await get(`${ADMIN}/admin/api/staff`, staffCookie);
  const body = await list.json().catch(() => ({}));
  check("staff API lists staff for a signed-in Super Admin", list.status === 200 && Array.isArray(body.items), `HTTP ${list.status}`);

  const cross = await fetch(`${ADMIN}/admin/api/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example", Cookie: staffCookie },
    body: JSON.stringify({ name: "Evil role" }),
  });
  check("cross-origin API write is rejected", cross.status === 403, `HTTP ${cross.status}`);

  const invalid = await post(ADMIN, "/admin/api/staff", { name: "", email: "bad", roleIds: [] }, { cookie: staffCookie });
  const inv = await invalid.json().catch(() => ({}));
  check("invalid staff input returns 422 with field errors", invalid.status === 422 && !!inv.fieldErrors?.email, `HTTP ${invalid.status}`);

  const bogus = await get(`${ADMIN}/admin/api/staff/not-a-uuid`, staffCookie);
  check("malformed ids return 404", bogus.status === 404, `HTTP ${bogus.status}`);

  // The storefront customer created above must be invisible to staff management (IDOR).
  const me = await fetch(`${WEB}/api/auth/get-session`, { headers: { Cookie: (await post(WEB, "/api/auth/sign-in/email", { email: custEmail, password: custPassword }).then(cookiesFrom)) } });
  customerId = (await me.json().catch(() => null))?.user?.id ?? null;
  if (customerId) {
    const idor = await get(`${ADMIN}/admin/api/staff/${customerId}`, staffCookie);
    check("customer records are not reachable via the staff API (404)", idor.status === 404, `HTTP ${idor.status}`);
  } else check("customer records are not reachable via the staff API (404)", false, "could not resolve customer id");

  const roles = await (await get(`${ADMIN}/admin/api/roles`, staffCookie)).json();
  const staffRole = roles.find?.((r) => r.key === "staff");
  const created = await post(ADMIN, "/admin/api/staff", { name: "Smoke Staff", email: `smoke.staff.${Date.now()}@example.test`, roleIds: [staffRole?.id] }, { cookie: staffCookie });
  const cj = await created.json().catch(() => ({}));
  check("Super Admin can create staff and an invitation is sent", created.status === 201 && cj.invite?.sent === true && cj.staff?.hasPassword === false, `HTTP ${created.status}`);

  const audit = await (await get(`${ADMIN}/admin/api/audit-logs?action=staff.create&pageSize=1`, staffCookie)).json();
  check("staff creation is in the audit log", audit.items?.[0]?.entityId === cj.staff?.id);
}

// 7. Sign-out invalidates the session
{
  const r = await post(ADMIN, "/admin/api/auth/sign-out", {}, { cookie: staffCookie });
  check("staff can sign out", r.status === 200, `HTTP ${r.status}`);
  const d = await get(`${ADMIN}/admin/dashboard`, staffCookie);
  check("old session cookie no longer opens the dashboard", [302, 303, 307].includes(d.status), `HTTP ${d.status}`);
}

// 8. Brute-force protection (5 sign-ins / minute / IP on this route)
{
  let limited = false;
  for (let i = 0; i < 8 && !limited; i++) {
    const r = await post(WEB, "/api/auth/sign-in/email", { email: `nobody${i}@example.test`, password: "wrong-password-1" });
    if (r.status === 429) limited = true;
  }
  check("repeated failed sign-ins are rate limited", limited);
}

console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}  (throwaway customer: ${custEmail})`);
process.exit(failures === 0 ? 0 : 1);
