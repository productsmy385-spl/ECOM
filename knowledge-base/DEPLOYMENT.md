# Deployment (Railway)

**Live since 2026-11-10** `[fact]`
| | URL |
|---|---|
| Storefront (`ECOM` service) | https://ecom-production-f9860cea.up.railway.app |
| Admin (`admin` service) | https://admin-production-87fd65e8.up.railway.app/admin |
| Health | `/api/health` · `/admin/api/health` (both report DB status) |

Railway project **zippy-joy**, environment **production**, region Southeast Asia. Services: `ECOM` (storefront), `admin`, `Postgres` (with volume). Both app services deploy from GitHub `productsmy385-spl/ECOM` (branch `main`) on every push that touches their watch paths.

## Infrastructure as code: `.railway/railway.ts`
This file is the source of truth for both app services: build (root `Dockerfile`), health checks, pre-deploy migration, replicas and variables. It **replaced** `railway.toml` / `railway.admin.toml` (Railway's config-as-code is deprecated after 2026-12-01).
- It's a **named partial** (`export const partial = "ECOM"`). It manages only `ECOM` and `admin`. **Postgres isn't declared**: it's referenced as `${{Postgres.DATABASE_URL}}`, so an apply can never modify or delete the database.
- Variables are **managed**: the file owns them. Secrets use `preserve()` and are set out-of-band, never committed.
- The admin service references the storefront's secrets (`${{ECOM.CLERK_SECRET_KEY}}` etc.), so both apps always share one value. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is also a Docker build arg, because Clerk reads it at build time.

```powershell
# Windows: the SDK's CLI-version check can't execute the npm shim. Point it at the binary first:
$env:_ = "$env:APPDATA\npm\node_modules\@railway\cli\bin\railway.exe"
railway config plan     # safe preview: always read it; must say "0 to destroy" unless intended
railway config apply    # apply the reviewed plan
```

## How a deploy works `[fact]`, verified 2026-11-10
1. Push to `main`. Railway builds the `Dockerfile` with `APP=web|admin` and `NEXT_PUBLIC_*` as build args.
   - **Builds need no database or secrets.** Storefront pages render at request time (`dynamic = "force-dynamic"` in the root layout), and auth is created lazily.
2. **Storefront only**: `preDeployCommand: node db/migrate.mjs` applies pending migrations once, before traffic, under an advisory lock. A failure aborts the deploy and the old version keeps serving.
3. The health check must return 200, which needs the DB to be reachable.
4. Traffic switches. Containers run as the non-root user `app` and listen on Railway's injected `PORT` (8080).

## Secrets and one-off tasks
| Task | Command |
|---|---|
| Set or rotate a secret | `railway variable set CLERK_SECRET_KEY --stdin --service ECOM` |
| Add Resend/ImageKit keys | Set them on `ECOM`; `admin` picks them up through references |
| Bootstrap or reset the first Super Admin | Run the seed bundle locally against Postgres's **public** URL (below). The seed is idempotent and creates the owner only if the email doesn't exist. |

Bootstrap procedure used on 2026-11-10 (no SSH key needed; nothing is printed or saved):
```powershell
pnpm --filter @ecom/db bundle
# read DATABASE_PUBLIC_URL from `railway variables --service Postgres --kv` into $env:DATABASE_URL,
# set SEED_SUPERADMIN_EMAIL / _PASSWORD / _NAME and NODE_ENV=production in the same shell, then:
node packages\db\dist\seed.mjs
```
Alternatively, register an SSH key (`railway ssh keys add`) and run `railway ssh --service ECOM -- node db/seed.mjs` inside the container.

## Rollback
- **App**: redeploy the previous deployment in Railway (one click), or `git revert` and push.
- **Infrastructure**: `git revert` the `.railway/railway.ts` change, then `railway config plan` / `apply`.
- **Schema**: migrations are forward-only. Fix forward. Restore from a Postgres backup only for data loss (see DATABASE.md). **Enable scheduled backups on the Postgres service** (not yet done; this needs a dashboard action by the owner).

## Known gaps
- No custom domain yet. Both apps use `*.up.railway.app`. When adding one, update the `WEB_URL`/`ADMIN_URL` references (they follow `RAILWAY_PUBLIC_DOMAIN`, so a custom domain needs explicit values).
- Email (Resend) isn't configured, so invitation and reset emails are logged as errors and not sent in production.
- ImageKit isn't configured, so uploads report "not configured".
- In-memory rate limits are fine for 1 replica each. Move them to Redis before scaling out.
