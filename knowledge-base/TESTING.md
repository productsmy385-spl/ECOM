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

## Phase 1 results (2026-11-10) `[fact]`
- `pnpm test`: **25/25 passed** (16 RBAC unit tests, 9 auth/isolation integration tests).
- `node scripts/smoke.mjs` against production builds: **14/14 passed**. Health, DB-backed storefront, admin redirect, staff login → dashboard, licence credit, customer sign-up, customer refused an admin session, customer cookie can't open admin, cross-origin rejected, sign-out invalidates, rate limit.
- Playwright visual pass at 1440×900 and 390×844 for storefront, admin login (including the wrong-password error), dashboard and mobile drawer. No horizontal overflow. The only console error is the expected 401 from the wrong-password step.
- `pnpm -r typecheck`, `pnpm -r lint` and `next build` for both apps: clean.

## Rules
- Every protected API gets a test proving (a) 401 when anonymous, (b) 403/404 without the permission, and (c) 404 for another user's record (IDOR).
- Don't mock the database in integration tests.
- The smoke script creates one `smoke.<ts>@example.test` customer per run. It must only target non-production environments, or production with a dedicated smoke account.
