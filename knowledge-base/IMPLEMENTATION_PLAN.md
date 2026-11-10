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
| Better Auth (web + admin), email OTP, rate limits, staff-only admin | ✅ | 9 integration tests + smoke |
| RBAC catalogue, 9 roles, guards, escalation rules | ✅ | 16 unit tests |
| Admin shell from DropX (pruned, rebranded, permission-filtered nav, real user menu and sign-out) | ✅ | screenshots at 1440 and 390 |
| Admin dashboard with live DB metrics, permission-scoped | ✅ | |
| Storefront foundation (tokens, live categories) | ✅ | |
| Health endpoints, Dockerfile, Railway config (migrations pre-deploy, web only) | 🟡 | Web image built and run locally: migrate, health, home and auth OK, non-root. Not yet deployed to Railway (needs credentials). |

## Phase 2: RBAC management ⬜
Staff list, invite and deactivate. Role CRUD. Permission matrix UI (with escalation guards). Audit log writer and viewer. Admin API guard helper. Password change. Security tests: 401, 403 and IDOR for each endpoint.

## Phase 3: Public website ⬜
`packages/validation` + `packages/services` (catalog). Bookly-inspired homepage (announcement bar, mega-nav, search, hero, rails, categories, reviews, newsletter, footer). `/shop` with filters and sorting. `/products/[slug]`. Database-driven search (tsvector + trigram). Admin product, category, brand and variant management (needed to have catalog data).

## Phase 4: Customization engine ⬜
Option configuration in admin. Customer configurator and canvas editor (layers, text, fonts, colour, image upload via signed ImageKit, reset, save, preview). Versioned designs.

## Phase 5: Customer accounts ⬜
Sign-up, sign-in (password and OTP), profile, addresses, wishlist, saved designs, account dashboard.

## Phase 6: Cart and checkout ⬜
Cart (guest and user, merge on login). Coupons. GST and shipping. Razorpay order, signature check, webhook and idempotency. COD flag. Transactional order creation with stock reservation. Redis and BullMQ.

## Phase 7: Admin operations ⬜
Orders (lifecycle, history, notes, invoices, packing slips). Customers. Payments and refunds. Inventory (ledger, suppliers, purchases). Dashboard charts and date filters.

## Phase 8: Workspaces ⬜
Designer, manager, staff and delivery captain workspaces (mobile-first, maps, proof upload). Notifications (in-app, email, FCM).

## Phase 9: Reports ⬜
Sales, revenue, product, category, customer, inventory, payment, refund, delivery and staff reports. CSV, XLSX and PDF export, permission-gated.

## Phase 10: Hardening and release ⬜
Playwright E2E. Load test. CSP. Redis rate limiting. Backup-restore drill. Railway production deploy. Clean ZIP.

## Known gaps and follow-ups (honest list)
- Railway deploy has not been executed. It needs a Railway project and credentials.
- Rate limiting uses per-instance memory. Move it to Redis before running more than one instance.
- Postgres RLS: evaluated and deferred, with backend enforcement instead (ARCHITECTURE.md §7).
- No real logo or product imagery yet. A monogram placeholder is in use.
- Docs from the spec not yet written (they belong to later phases): PRD.md, API_DOCUMENTATION.md, PAYMENT_FLOW.md, ORDER_WORKFLOW.md, DESIGN_CUSTOMIZATION.md.
