# Testing

| Layer | Tool | Location | Run |
|---|---|---|---|
| Unit | Vitest 5 | `packages/**/*.test.ts` | `pnpm test` |
| Integration (real DB) | Vitest 5 | `*.integration.test.ts` | `pnpm test` |
| HTTP smoke (running apps) | Node script | `scripts/smoke.mjs` | `node scripts/smoke.mjs` |
| E2E / visual | Playwright 1.65 | `tests/e2e/` (Phase 3 onwards) | `pnpm exec playwright test` |

## Test database
- Integration tests run against `ecom_test` (`TEST_DATABASE_URL`), never the dev database.
- `tests/global-setup.ts` migrates and seeds it with a known Super Admin (`root@test.local`). It refuses to run if `TEST_DATABASE_URL` equals `DATABASE_URL`.
- Files run serially because they share one database. Each file cleans up the rows it creates, using a per-run email suffix.

## Phases 9–10 results (2026-11-11) `[fact]`
- **Vitest:** 133 tests pass, including 7 for reports and exports.
- **Playwright** (`pnpm e2e`, run against `next start` builds on 3300/3301): 15 passed, 1 skipped. Point `WEB_URL`/`ADMIN_URL` at the deployed apps to run the same suite there.
- **Before pushing:** `DATABASE_URL= pnpm --filter @ecom/admin --filter @ecom/web build` must pass. Modules must not touch the database at import time.

## Testing with Clerk (from 2026-11-11)
- **Integration tests never call Clerk.** `resolveClerkUser(id, fetchIdentity)` takes the identity as a function, so tests inject one (`packages/auth/src/auth.integration.test.ts`).
- **Smoke test** (`scripts/smoke.mjs`) mints short-lived session tokens with the Clerk Backend API (`sessions.createSession` and `getToken`) and sends them as `Authorization: Bearer`. It creates and deletes one `smoke-…+clerk_test@example.com` Clerk user. Staff checks need `SMOKE_STAFF_EMAIL`: a Super Admin who already has a Clerk account. They are skipped otherwise. This requires a Clerk **development** instance.
- **Browser flows** use `@clerk/testing/playwright` (`clerkSetup` plus `setupClerkTestingToken`) to bypass bot protection. Use `…+clerk_test@example.com` addresses; their verification code is always **424242**. Clerk asks for that code on a new device (`#/client-trust`).
- On localhost both apps share Clerk's cookies (same host, different ports), so one browser context is signed in to both. On Railway they are separate domains.

## Phase 6 results (2026-11-11) `[fact]`
- `pnpm test`: **115/115 passed**. New: 8 pricing unit tests and 13 checkout integration tests. Razorpay is exercised through a fake `PaymentGateway` that uses real HMAC signatures, so no keys or network are needed.
- Browser end-to-end against dev servers and the Clerk dev instance: **17/17 passed**.
  - **Admin:** checkout settings (COD on); coupon created and listed.
  - **Guest:** PDP quantity 2 updates the header bag count; an invalid code shows an error; a 10% code takes ₹119.80 off ₹1,198; missing checkout fields are flagged; express adds ₹149; COD order placed lands on the private order page; the bag is empty afterwards.
  - **Order access:** the order page without its token is a 404; the token link works from any browser.
  - **Customer:** signing in merges the guest bag; COD order; it appears in My orders; the saved address is preselected next time.
  - **General:** no mobile overflow on bag or checkout; no page errors.
- Bug found and fixed: after ordering, client navigation left the header's bag count stale, because the root layout isn't re-rendered. Checkout now does a full page load to the order page.
- Lint, typecheck and `next build` (both apps): clean.

## Clerk migration results (2026-11-11) `[fact]`
- `pnpm test`: **94/94 passed**.
- `node scripts/smoke.mjs` (dev servers, temporary Clerk staff user): **34/34 passed**. Covers anonymous redirects and 401s, unsigned webhook refused, customer provisioned on first request, cross-origin 403, customer to `/admin/no-access` and 401, staff dashboard, IDOR 404, Clerk invitation sent, and the catalog lifecycle.
- Browser end-to-end: **23/24**. Seeded Super Admin linked on first Clerk sign-in; staff created and invited; invitation accepted via `/admin/accept-invite`; invitee lands on the dashboard with the Staff role, and an out-of-permission page goes to `/forbidden`; deactivation leads to `/no-access` and API 401; customer `/account` → `/login?next=` → back; Clerk `<UserProfile>` renders; customer in admin gets `/no-access`; sign-out leads to 401; no mobile overflow; no page errors. The one miss was a header assertion run before client navigation finished; the same control was used successfully later in the run.
- Lint, typecheck and `next build` (both apps): clean.

## Phase 1 results (2026-11-10) `[fact]`
- `pnpm test`: **25/25 passed** (16 RBAC unit tests, 9 auth/isolation integration tests).
- `node scripts/smoke.mjs` against production builds: **14/14 passed**. Health, DB-backed storefront, admin redirect, staff login → dashboard, licence credit, customer sign-up, customer refused an admin session, customer cookie can't open admin, cross-origin rejected, sign-out invalidates, rate limit.
- Playwright visual pass at 1440×900 and 390×844 for storefront, admin login (including the wrong-password error), dashboard and mobile drawer. No horizontal overflow. The only console error is the expected 401 from the wrong-password step.
- `pnpm -r typecheck`, `pnpm -r lint` and `next build` for both apps: clean.

## Phase 2 results (2026-11-10) `[fact]`
- `pnpm test`: **47/47 passed** (17 RBAC unit, 9 auth integration, 21 staff/roles/audit integration).
- `node scripts/smoke.mjs` against fresh production builds: **22/22 passed**. This adds admin API 401, cross-origin write 403, 422 field errors, malformed id 404, customer id 404 (IDOR), staff creation with invitation, and the matching audit entry.
- Lint, typecheck and `next build`: clean.

Note: sign-in is rate limited to 5 per minute per IP, and this includes localhost. Back-to-back smoke and Playwright runs can hit it. Reuse one signed-in session (`storageState`) in browser scripts.

## Phase 3 results (2026-11-10) `[fact]`
- `pnpm test`: **66/66 passed** (adds 19 catalog tests covering permissions, slugs, SKUs, stock ledger, publish rules, soft delete, visibility, filters, facets, sorting, typo search, suggestions and the newsletter).
- `node scripts/smoke.mjs`: **34/34 passed**. This adds the full catalog lifecycle over HTTP (create a draft, check it's hidden, publish, page and search, then delete and confirm 404), no stock-count leak, ImageKit signing status, and newsletter cross-origin and validation checks.
- Playwright at 1440 and 390: home, search suggestions (keyboard and Enter), shop + filters (optimistic) + chips, quick view, mobile filter sheet and menu, product page with variant switching, plus the admin products, editor and categories screens. No horizontal overflow and no console errors.
- Defects found and fixed during verification:
  - Single-word typo search returned nothing; switched to `word_similarity`.
  - Filter checkboxes lagged behind the URL; switched to `useOptimistic`.
  - The category bar wrapped onto two lines.
  - pg concurrent-query deprecation inside transactions.

## Phase 4 results (2026-11-11) `[fact]`
- `pnpm test`: **89/89 passed** (adds 10 design-model unit tests and 13 customisation integration tests).
- Playwright end-to-end (desktop and mobile): admin options preset → customer picks options, adds and drags text, changes font → live price ₹1,598 (base ₹1,299 + ₹99 + ₹200) → save → submit → staff assign → request changes → customer sees the message, edits and resubmits → staff approve → editing locked. Another visitor gets 404 on the page and the API. No console errors and no overflow.
- Defects found and fixed: the mobile action buttons collapsed (`flex-1` in a column); dragging selected SVG text.

## Phase 5 results (2026-11-11) `[fact]`
- `pnpm test`: **95/95 passed** (adds 6 account integration tests).
- Playwright end-to-end (production build). Every check passed:
  - **Guest to customer:** guest design saved; signed-out heart redirects to `/login?next=`; registration rejected a weak password, then succeeded and returned to `next`; the guest design was claimed into the account.
  - **Account features:** wishlist badge and page; address with a bad PIN rejected, then saved as default; profile saved; password changed; signed out and back in with the new password.
  - **No email provider:** the email-code tab is hidden.
  - **Protection:** anonymous `/account` redirects to login; anonymous API gets 401; a second customer gets 404 on the first customer's design and sees no addresses; cross-origin write gets 403.
  - **Mobile:** no overflow.
- **Defect found and fixed:** the wishlist badge was stale after client-side sign-in (provider state survived the auth change). Regression script confirms the fix.

## Rules
- Every protected API gets a test proving (a) 401 when anonymous, (b) 403/404 without the permission, and (c) 404 for another user's record (IDOR).
- Don't mock the database in integration tests.
- The smoke script creates one `smoke.<ts>@example.test` customer per run. It must only target non-production environments, or production with a dedicated smoke account.
