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
