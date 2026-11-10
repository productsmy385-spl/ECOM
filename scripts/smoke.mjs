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
