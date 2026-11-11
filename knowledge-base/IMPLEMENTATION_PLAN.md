# Implementation plan and progress

Status key: ✅ done and verified · 🟡 partly done · ⬜ not started. Progress is tracked here because Linear is deliberately skipped for now (decided 2026-11-10).

## Phase 1: Foundation ✅ (2026-11-10)
| Item | Status | Evidence |
|---|---|---|
| Reference ZIPs inspected; analysis and architecture | ✅ | REFERENCE_ANALYSIS.md, ARCHITECTURE.md |
| pnpm monorepo (`apps/web`, `apps/admin`, `packages/db, auth, rbac, ui`) | ✅ | |
| Design system: brand tokens, Sora + Inter, contrast-checked | ✅ | `packages/ui/src/tokens.css`, UI_UX_GUIDELINES.md |
| Docker Postgres 17 + Redis 7 (+ `ecom_test` DB) | ✅ | `docker/docker-compose.yml` |
| Drizzle schema (52 tables), 2 migrations, idempotent seed | ✅ | migrate and seed (run twice) OK, oversell CHECK verified |
| Better Auth (web + admin), email OTP, rate limits, staff-only admin | ✅ → replaced | Replaced by Clerk on 2026-11-11 (see "Clerk migration" below) |
| RBAC catalogue, 9 roles, guards, escalation rules | ✅ | 16 unit tests |
| Admin shell from DropX (pruned, rebranded, permission-filtered nav, real user menu and sign-out) | ✅ | screenshots at 1440 and 390 |
| Admin dashboard with live DB metrics, permission-scoped | ✅ | |
| Storefront foundation (tokens, live categories) | ✅ | |
| Health endpoints, Dockerfile, Railway config (migrations pre-deploy, web only) | ✅ | **Deployed 2026-11-10** via `.railway/railway.ts`; live health, owner login and protections verified (DEPLOYMENT.md) |

## Phase 2: RBAC management ✅ (2026-11-10)
| Item | Status | Evidence |
|---|---|---|
| `packages/services` (staff, roles, audit) + `packages/validation` (Zod) | ✅ | Permission checks live inside the services |
| Admin API wrapper (`apiRoute`): session, same-origin check, error mapping | ✅ | API_DOCUMENTATION.md |
| Staff: list, filter, create, edit, deactivate/reactivate, invite/resend | ✅ | Invitation is now a Clerk invitation (7 days); see AUTHENTICATION.md |
| Roles: list, create, rename, delete (blocked for system or in-use roles) | ✅ | Unique names enforced in the DB (`roles_name_lower_uq`, migration 0002) |
| Permission matrix: grouped by module, escalation-safe, Super Admin locked, batched saves | ✅ | |
| Audit log: written in the same transaction as each change; viewer with before/after | ✅ | |
| My account + change password; forgot/reset password pages | ✅ | Staff minimum 10 characters, enforced server-side |
| Escalation guards: no self-role change, no managing someone more powerful, last-Super-Admin protection (row-locked) | ✅ | 21 integration tests + 1 new unit test |
| HTTP smoke extended (401, cross-origin 403, 422, 404 IDOR, create + audit) | ✅ | 22/22 |

Not in Phase 2:
- Audit entries for *self-service* sign-in changes (password, email) happen in Clerk. A Clerk webhook can add them in Phase 10.
- Staff deletion. Deactivation is used instead, which keeps the audit history intact.

## Phase 3: Public website + catalog management ✅ (2026-11-10)
| Item | Status | Evidence |
|---|---|---|
| Catalog services: categories (2-level tree, cycle-safe), brands, products, variants, specs, images, publish rules, soft delete, stock ledger adjustments | ✅ | 19 integration tests |
| Admin: Products list and editor, Categories, Brands, stock adjustment dialog | ✅ | Permission-gated per control |
| ImageKit signed uploads (browser → ImageKit; HMAC-SHA1 signature, 30 min) | 🟡 | Built. Untested against real ImageKit until keys are provided; returns 503 "not configured" today. |
| Storefront: header (announcement, search with suggestions, mega-nav, mobile drawer), homepage (hero, trust strip, categories, trending, best sellers, new arrivals, customisable, promo banners, brands, reviews), footer + newsletter | ✅ | Each section is hidden when it has no real data |
| `/shop`: search, category (incl. sub-categories), brand, colour, size, material, price, rating, stock and tag filters; 6 sorts; pagination; facets; chips; mobile filter sheet | ✅ | |
| Search: full-text (`tsvector`) + word-similarity trigram (typos) + brand/category/colour/material/SKU/spec matches | ✅ | "aviatr" → Aviator |
| `/products/[slug]`: gallery, variant picker (shareable `?v=`), price/MRP/discount, coarse availability, delivery estimate, specs, reviews + breakdown, related, JSON-LD | ✅ | |
| Quick view, `/categories`, `/about`, `/contact`, 404, `robots.txt`, `sitemap.xml` | ✅ | |
| Dev-only demo catalog (`pnpm --filter @ecom/db seed:dev-catalog [--remove]`) | ✅ | Refuses production. `DEV-` SKUs, fictional brands, no images. |

Deferred, deliberately:
- **Cart, wishlist, account and buy buttons**: Phases 5–6. They aren't shown until they work.
- **Customer review submission**: Phase 5 (needs accounts and delivered orders). Reviews are displayed now.
- **Admin banner management**: Phase 7. Without banners the homepage uses its built-in brand hero.
- **Caching**: storefront pages render dynamically for correctness. Redis/ISR caching is planned for Phase 10.
- **Real product photography**: still needed. Placeholders read "Image coming soon".

## Phase 4: Customization engine ⬜
Option configuration in admin. Customer configurator and canvas editor (layers, text, fonts, colour, image upload via signed ImageKit, reset, save, preview). Versioned designs.

## Phase 5: Customer accounts ✅ (2026-11-11)
- ✅ Register, sign in (password; email code when email is configured), forgot/reset, sign out. Safe `?next=` return paths.
- ✅ Account area: overview, profile + password + devices (sign out others), address book (Indian validation, single default), wishlist, designs.
- ✅ Header account menu + wishlist count; hearts on product cards and product pages (optimistic, rolls back on failure).
- ✅ Guest designs claimed into the account on sign-in.
- ✅ 6 integration tests (isolation, default rules, wishlist, profile) + browser end-to-end (guest → register → claim → wishlist → addresses → password → re-sign-in; cross-customer 404, anonymous 401, cross-origin 403).
- 🟡 Email-code sign-in and reset emails are untested end to end until Resend is configured (the UI hides or explains them meanwhile).

## Clerk migration ✅ (2026-11-11)
Authentication moved from Better Auth to Clerk at the user's request (OPEN_QUESTIONS #3a). See [AUTHENTICATION.md](AUTHENTICATION.md).
- ✅ `users.clerk_user_id`; first sign-in links by **verified** email or creates a customer (never staff). Better Auth tables dropped (migration 0003).
- ✅ Admin: Clerk `<SignIn>` and `/accept-invite` (`<SignUp>` with an invitation ticket), `/no-access`, `<UserProfile>` on My account. Staff invitations are sent by Clerk; deactivation also revokes Clerk sessions.
- ✅ Storefront: `<SignIn>`/`<SignUp>` with `?next=`, `<UserProfile>` on Profile & security, optional `/api/webhooks/clerk`.
- ✅ 94 tests (auth identity tests rewritten). Smoke test (34 checks) uses Clerk Bearer session tokens. Browser end-to-end (23/24, the one miss a test-timing artefact): staff sign-in, invite, accept, forbidden, deactivate, no-access, customer sign-in and sign-out, mobile.
- Phase 5 notes below that mention passwords, email codes or "devices" describe the Better Auth version. Those features are now Clerk's.

## Phase 6: Cart and checkout ✅ (2026-11-11)
- ✅ **Bag.** Guests and customers, merged on sign-in. Lines are re-priced live, with stock checks and per-line issues. Finished designs can be added, priced with their options. Products with required options need a design. Header count.
- ✅ **Pricing.** One pure function, `priceOrder` in `@ecom/validation`, is shared by the bag, checkout and the order: GST-inclusive with tax extracted per line, discount split proportionally, free standard shipping threshold, express fee.
- ✅ **Coupons.** Percent (with cap), fixed or free shipping; minimum order, dates, total and per-customer limits. Re-checked under a row lock at order time. Admin **Coupons** page.
- ✅ **Checkout.** Guest (email) or customer (saved or new address), standard or express, Razorpay or COD. One transaction does everything: re-price, reserve stock (it can't oversell), redeem the coupon, snapshot items and address, record history and the payment row, clear the bag. Idempotency key. Order numbers `ORD-YYYY-NNNNNN` from a sequence.
- ✅ **Razorpay** over REST: order creation, Checkout.js, HMAC signature check plus a payment re-fetch and capture, a signature-verified idempotent webhook, and "Pay now" retry. **Inactive until keys are set.** Unpaid orders are cancelled after the hold and their stock and coupon use released; Razorpay is asked first, in case a payment was missed.
- ✅ **Order page.** Customer session or guest secret link, with progress, totals and address. Account → Orders.
- ✅ **Admin Checkout settings.** Guest checkout, COD and its limit, shipping fees and days, payment hold.
- ✅ **Tests.** 8 pricing unit tests and 13 checkout integration tests (ownership, design rules, coupons, merge, idempotency, a concurrent last-unit race with exactly one winner, signature forgery, webhook dedupe, hold release, late-payment recovery). Browser end-to-end 17/17: admin settings and coupon, guest bag → coupon → checkout → COD order, token-only access, sign-in merge, saved address, My orders, mobile.
- 🟡 **Not done.** BullMQ and Redis: the hold sweep runs in-process instead (OPEN_QUESTIONS #14). Live Razorpay end to end is untested until keys exist; only the fake gateway was used. Order confirmation emails depend on Resend and arrive in Phase 7 with order management.

## Phase 7: Admin operations ✅ (2026-11-11)
- ✅ **Orders.** List (search, status and method filters) and detail (items with design status, customer, address, payments, refunds, history, internal notes). Status moves follow `ORDER_TRANSITIONS`, with effects in the same transaction:
  - shipping turns the reservation into fulfilment (stock leaves on-hand);
  - cancelling needs a reason and releases unfulfilled stock and coupon use;
  - delivery records cash on delivery as collected;
  - a return restocks.

  Design approval is required before production. Assignment to staff is available. `orders.view_assigned` sees assigned orders only (404 otherwise).
- ✅ **Printables.** Invoice (GST shown per line, seller GSTIN and address from settings) and packing slip, both print or save as PDF.
- ✅ **Payments and refunds.** Payments list. Refunds go through Razorpay for online orders and are recorded manually for COD. The amount is reserved under lock and rolled back if the gateway fails, and can never exceed what was captured. A full refund of a cancelled or returned order ends as Refunded.
- ✅ **Customers.** List with orders and spend (staff never listed). Detail with orders and addresses. Suspend or reactivate also signs them out of Clerk.
- ✅ **Inventory.** Stock list (lowest first, low-only filter), per-variant ledger, manual adjustment with a reason, low-stock threshold. Suppliers (GSTIN validated). Purchases: draft → ordered → received (adds stock through the ledger) or cancelled.
- ✅ **Dashboard.** Needs-attention queue, a 30-day paid revenue chart (validated colours, hover tooltips, screen-reader table), top products and latest orders. Money figures are shown only with `reports.view` or `payments.view`.
- ✅ **Fix.** Correlated sub-query counts were always 0, because Drizzle writes columns unqualified in single-table queries. This affected category, brand and variant product counts and the product list's stock. All are now table-qualified, with a regression test (KNOWN-ISSUES).
- ✅ **Tests.** 123 passing (8 new operations tests). Browser/API check against a production build: 28/28.
- 🟡 **Next.** Customer-facing invoice download and order emails (Phase 8, with Resend). Date-range filters on the dashboard (Phase 9 reports).

## Phase 8: Workspaces, deliveries and notifications ✅ (2026-11-11)
- ✅ **Deliveries.**
  - Created automatically when an order is packed; managers are alerted.
  - Managers assign or reassign a captain (assignment history kept) and can reattempt failed deliveries.
  - Captains see only their own deliveries.
  - Captain flow: picked up (order → shipped, stock leaves) → out for delivery → delivered (COD must be confirmed as collected; optional ImageKit proof photo; best-effort GPS in the log) or failed (reason required; managers alerted).
  - Order transitions reuse the order workflow (`applyOrderTransition`), so stock and payment effects are identical.
- ✅ **Captain UI.** Phone-first cards, Call and Directions (Google Maps link, no API key needed), and big action buttons.
- ✅ **My work** (`/workspace`) shows every staff member's own queues: deliveries, assigned orders, assigned designs, designs to assign, low stock. It is the landing page for roles without a dashboard, such as captains.
- ✅ **Notifications.**
  - In-app bell in the admin header: unread badge, refreshes each minute, mark read or all read.
  - Staff hear about: new orders (COD on placement, online once paid), packed orders needing a captain, failed deliveries, designs submitted for review, and assignments (orders, designs, deliveries). You're never notified about your own action.
- ✅ **Customer emails** via Resend: order placed, payment received, shipped, out for delivery, delivered, cancelled. Sent after commit and never blocking. Without `RESEND_API_KEY` they're logged.
- ✅ **Uploads.** Upload signing is now also allowed for designers and delivery captains.
- ✅ **Tests.** 126 passing (3 new delivery and notification tests). Production-build API and page check: 20/20 real checks (the 21st asserted a self-notification, which is correctly suppressed).
- 🟡 **Not done.** FCM push: `push_tokens` exists but there are no Firebase keys. BullMQ queue: emails are sent inline after commit. Live map tracking.

## Phase 9: Reports ⬜
Sales, revenue, product, category, customer, inventory, payment, refund, delivery and staff reports. CSV, XLSX and PDF export, permission-gated.

## Phase 10: Hardening and release ⬜
Playwright E2E. Load test. CSP. Redis rate limiting. Backup-restore drill. Railway production deploy. Clean ZIP.

## Phase 4: Customisation engine ✅ (2026-11-11)
See [DESIGN_CUSTOMIZATION.md](DESIGN_CUSTOMIZATION.md).
- ✅ Shared design model and pricing, SVG renderer, services (options, designs, versions, submit, review, assignment, claim). 23 tests.
- ✅ Admin: options builder with presets and live canvas preview; Designs queue and detail (exact render, choices, prescription, images, history, assign, approve/changes/reject, notes).
- ✅ Storefront: `/customize/[productId]` editor; `/designs` and `/designs/[id]`; "Customise this product" on product pages, shown only when configured.
- ✅ Browser end-to-end: configure → design → submit → assign → request changes → customer revises → approve. Other visitors get 404. Mobile is OK.
- 🟡 Customer image uploads are built but untested against real ImageKit (needs keys).

## Known gaps and follow-ups (honest list)
- Production: enable Postgres scheduled backups; configure Resend and ImageKit; add a custom domain (DEPLOYMENT.md).
- Rate limiting uses per-instance memory. Move it to Redis before running more than one instance.
- Postgres RLS: evaluated and deferred, with backend enforcement instead (ARCHITECTURE.md §7).
- No real logo or product imagery yet. A monogram placeholder is in use.
- Docs from the spec not yet written (they belong to later phases): PRD.md, PAYMENT_FLOW.md, ORDER_WORKFLOW.md, DESIGN_CUSTOMIZATION.md.
- A staff email can't already belong to a customer account. Staff members need a separate address (409 otherwise). Promoting existing customers to staff is not supported `[proposed]`.
