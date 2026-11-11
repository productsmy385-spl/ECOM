# Architecture

Single-business e-commerce platform. **Not** SaaS and **not** multi-tenant: one store, one catalog, one database. Data isolation happens per customer and per staff role or assignment, never per tenant.

## Topology

```
                   ┌────────────────────────────┐
 customers ──────► │ apps/web   (Next.js 16)    │──┐
                   │  storefront + /api/*       │  │
                   └────────────────────────────┘  │   packages/*  (shared code)
                   ┌────────────────────────────┐  ├─► db · auth · rbac · ui
 staff ──────────► │ apps/admin (Next.js 16)    │──┘        │
                   │  basePath /admin + /admin/api/*        ▼
                   └────────────────────────────┘    PostgreSQL (Railway)
                                                     Redis (Railway) — Phase 6+
```

| Unit | Responsibility |
|---|---|
| `apps/web` | Customer storefront and customer REST API (`/api/*`). Customer auth at `/api/auth/*`. |
| `apps/admin` | Admin dashboard and staff REST API. Served under `/admin`, staff auth at `/admin/api/auth/*`. |
| `packages/db` | Drizzle schema, SQL migrations, pooled client, idempotent seed, bundled migrate/seed runners. |
| `packages/auth` | Clerk-to-`users` linking (`resolveClerkUser`), the Clerk Backend API client (invitations, session revocation), actor loading, transactional email. |
| `packages/rbac` | Permission catalogue, the 9 system roles, guards (`can`, `requirePermission`, `canAccessAssigned`, escalation checks). Pure code with no I/O. |
| `packages/ui` | Brand design tokens (`tokens.css`), brand constants, INR formatting. |

Planned packages, created in the phase that needs them so none ship empty:
- `packages/validation`: shared Zod schemas (Phase 3).
- `packages/services`: domain logic for catalog, cart, pricing, orders, payments, inventory, designs and delivery (Phase 3 onwards). Route handlers stay thin and follow one pattern: authenticate, authorize, validate, call a service, respond.

## Key decisions
Full entries are in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) under "Resolved".

1. **Two Next.js apps, one database.** Customers and staff get separate deployables, separate session cookies (`ecom.*` and `ecom_admin.*`) and separate auth endpoints. A customer cookie can never authenticate an admin request, and the smoke test checks this.
2. **The admin app runs under `basePath: "/admin"`.** Routes match the spec (`/admin/dashboard`, ...), and one domain can front both apps later. Clerk URLs in the admin are written with the `/admin` prefix (`/admin/login`, `/admin/accept-invite`).
3. **Clerk for authentication, our `users` table for identity** (decided 2026-11-11, superseding Better Auth from 2026-11-10). Every foreign key and isolation check uses our `users.id`; Clerk's id is only the link (`users.clerk_user_id`). Clerk proves who you are. Our database decides what you may do.
4. **Authorization lives in the backend and is driven by the database.** Permissions are re-read from the DB on every request (`loadActor`), so revoking a permission takes effect immediately. Hiding navigation items is a UX convenience only.
5. **Money is stored as integer paise.** It is formatted only in `@ecom/ui/format`. Prices are GST-inclusive, as is standard for Indian retail.
6. **Auth is created lazily (`getAuth()`).** `next build` imports route modules, and runtime secrets must not be needed at build time `[fact]`.
7. **Postgres Row-Level Security is deferred** `[proposed]`. Isolation is enforced in services through ownership and assignment predicates (`isOwner`, `canAccessAssigned`) and proven by tests. RLS with a pooled connection needs per-transaction `set_config`. We will revisit it once the services layer exists. See [SECURITY.md](SECURITY.md).

## Request flow (admin page)
1. `app/(admin)/layout.tsx` calls `requireStaff()`. This resolves the session, loads the actor from the DB, and redirects to `/login` when there is no session.
2. Each page calls `requireStaff("<permission>")` again, because layouts do not re-run on client navigation. A missing permission redirects to `/forbidden`.
3. Data is read server-side with only the queries the actor's permissions allow (see `lib/queries/dashboard.ts`).

## Environment loading
Locally, both apps read one root `.env` through `process.loadEnvFile` in `next.config.ts`. That never overrides variables already set, so on Railway the injected values win. Tests point `DATABASE_URL` at `TEST_DATABASE_URL`.
