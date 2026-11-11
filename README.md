# Crimsonne: custom-design e-commerce platform

The storefront and admin dashboard for a single business selling cosmetics, eyewear and accessories, with product customization. "Crimsonne" is a placeholder brand name, set through `NEXT_PUBLIC_BRAND_NAME`.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · PostgreSQL 17 + Drizzle · Clerk · pnpm workspaces · Railway.

```
apps/web      storefront              http://localhost:3000
apps/admin    admin dashboard         http://localhost:3001/admin
packages/db   schema, migrations, seed
packages/auth Clerk ↔ users linking, staff invitations, actor (roles/permissions) loading, email
packages/rbac permissions, roles, guards
packages/ui   brand tokens, formatting
knowledge-base/   all project documentation
```

## Quick start
Requires Node ≥ 20, pnpm 12 and Docker.

```bash
pnpm install
cp .env.example .env          # then set the CLERK_* keys and SEED_SUPERADMIN_EMAIL
pnpm db:up                    # Postgres :5433, Redis :6380
pnpm db:migrate
pnpm db:seed                  # roles, permissions, categories, first Super Admin
pnpm dev                      # web :3000 + admin :3001
```

Sign in at http://localhost:3001/admin/login through Clerk with the `SEED_SUPERADMIN_EMAIL` address. Your first sign-in links that Clerk account to the seeded Super Admin record, and it only links when the email is verified.

Optional, **development only**: load a demo catalog (12 products, fictional brands, no images) so the storefront has something to show. This is refused in production.

```bash
pnpm --filter @ecom/db seed:dev-catalog            # add
pnpm --filter @ecom/db seed:dev-catalog --remove   # remove
```

## Checks
```bash
pnpm test                     # unit + integration (uses ecom_test DB)
pnpm typecheck && pnpm lint
pnpm build
node scripts/smoke.mjs        # HTTP smoke test against running apps
```

## Documentation
See [knowledge-base/README.md](knowledge-base/README.md). Current status is in [IMPLEMENTATION_PLAN.md](knowledge-base/IMPLEMENTATION_PLAN.md).

## Credits
The admin dashboard is built on **DropX Admin** by DataDropX. Its in-app credit was replaced with "Designed by Kranas Tech" at the owner's request (knowledge-base/OPEN_QUESTIONS.md #7a). The storefront's layout and motions follow the "Bookly" template's design, re-implemented as original code; none of Bookly's code or assets are used (#6a).
