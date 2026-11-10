# Crimsonne: custom-design e-commerce platform

The storefront and admin dashboard for a single business selling cosmetics, eyewear and accessories, with product customization. "Crimsonne" is a placeholder brand name, set through `NEXT_PUBLIC_BRAND_NAME`.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · PostgreSQL 17 + Drizzle · Better Auth · pnpm workspaces · Railway.

```
apps/web      storefront              http://localhost:3000
apps/admin    admin dashboard         http://localhost:3001/admin
packages/db   schema, migrations, seed
packages/auth Better Auth config, actor loading, email
packages/rbac permissions, roles, guards
packages/ui   brand tokens, formatting
knowledge-base/   all project documentation
```

## Quick start
Requires Node ≥ 20, pnpm 12 and Docker.

```bash
pnpm install
cp .env.example .env          # then set BETTER_AUTH_SECRET and SEED_SUPERADMIN_*
pnpm db:up                    # Postgres :5433, Redis :6380
pnpm db:migrate
pnpm db:seed                  # roles, permissions, categories, first Super Admin
pnpm dev                      # web :3000 + admin :3001
```

Sign in at http://localhost:3001/admin/login with the `SEED_SUPERADMIN_*` credentials.

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
The admin dashboard is built on **DropX Admin** by [DataDropX](https://datadropx.net) under the DropX Admin License, which requires the in-app credit to stay visible. The storefront layout takes visual inspiration from the free "Bookly" template by TemplatesJungle; none of its code or assets are used.
