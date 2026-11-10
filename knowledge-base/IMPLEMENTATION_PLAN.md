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

## Phase 2: RBAC management ✅ (2026-11-10)
| Item | Status | Evidence |
|---|---|---|
| `packages/services` (staff, roles, audit) + `packages/validation` (Zod) | ✅ | Permission checks live inside the services |
| Admin API wrapper (`apiRoute`): session, same-origin check, error mapping | ✅ | API_DOCUMENTATION.md |
| Staff: list, filter, create, edit, deactivate/reactivate, invite/resend | ✅ | Invitation = Better Auth single-use set-password link (24 h) |
| Roles: list, create, rename, delete (blocked for system or in-use roles) | ✅ | Unique names enforced in the DB (`roles_name_lower_uq`, migration 0002) |
| Permission matrix: grouped by module, escalation-safe, Super Admin locked, batched saves | ✅ | |
| Audit log: written in the same transaction as each change; viewer with before/after | ✅ | |
| My account + change password; forgot/reset password pages | ✅ | Staff minimum 10 characters, enforced server-side |
| Escalation guards: no self-role change, no managing someone more powerful, last-Super-Admin protection (row-locked) | ✅ | 21 integration tests + 1 new unit test |
| HTTP smoke extended (401, cross-origin 403, 422, 404 IDOR, create + audit) | ✅ | 22/22 |

Not in Phase 2:
- Audit entries for *self-service* password changes. Better Auth handles those directly; a hook will add them in Phase 10.
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
- Docs from the spec not yet written (they belong to later phases): PRD.md, PAYMENT_FLOW.md, ORDER_WORKFLOW.md, DESIGN_CUSTOMIZATION.md.
- A staff email can't already belong to a customer account. Staff members need a separate address (409 otherwise). Promoting existing customers to staff is not supported `[proposed]`.
