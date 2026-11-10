# Deployment (Railway)

Railway hosts three services in one project: **Postgres**, **web**, **admin** (plus **Redis** from Phase 6). Both app services build from this repo with the root `Dockerfile`.

## One-time setup
1. Create a Railway project and add the **PostgreSQL** plugin. Enable backups.
2. Create service **web** from the GitHub repo:
   - Config file: `railway.toml` (the default)
   - Variables: `APP=web`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `BETTER_AUTH_SECRET`, `WEB_URL`, `ADMIN_URL`, and the brand and email variables
   - Generate a domain, then set `WEB_URL` to it.
3. Create service **admin** from the same repo:
   - Settings → Config-as-code path: `railway.admin.toml`
   - Variables: the same as web, but `APP=admin`. Use the **same** `BETTER_AUTH_SECRET`.
   - Domain: either a separate domain (set `ADMIN_URL`), or put both behind one domain with `/admin/*` routed to this service.
4. First deploy of **web** runs migrations automatically. Then bootstrap the owner account once:
   ```
   railway run --service web node db/seed.mjs   # with SEED_SUPERADMIN_* set
   ```
   Remove the `SEED_SUPERADMIN_*` variables afterwards.

## How a deploy works `[fact]` for config, `[assumption]` until first real Railway deploy
1. Docker build: `pnpm install --frozen-lockfile`, then the migrate/seed bundles, then `next build` for `$APP`. Runtime secrets aren't needed at this stage.
2. **web only**: `preDeployCommand = node db/migrate.mjs` runs once in the new image, **before** traffic moves. It takes a Postgres advisory lock, so overlapping deploys queue rather than race. If a migration fails, the deploy is aborted and the old version keeps serving.
3. Railway health checks `/api/health` (web) or `/admin/api/health` (admin). Both return 503 if the DB is unreachable.
4. Traffic switches to the new version.

Migrations run from exactly one service and never at app start-up, so multiple instances never race. Production never uses `drizzle-kit push`. Migrations are additive only (see DATABASE.md).

## Verified locally (2026-11-10)
- Production builds of both apps: OK
- `node packages/db/dist/migrate.mjs` (the same bundle the image runs): OK, no-op on an up-to-date DB
- `docker build --build-arg APP=web .`: OK (74 MB image). In the container, `node db/migrate.mjs` (the preDeployCommand) succeeded, `/api/health` returned 200 with the DB connected, the home page rendered DB categories, `/api/auth/ok` responded, and the process runs as the non-root user `app`.
- The `APP=admin` image uses the same Dockerfile but has not been built separately yet.
- Not yet verified on Railway itself: needs your Railway project and credentials.

## Rollback
- **App**: redeploy the previous deployment in Railway (one click).
- **Schema**: migrations are forward-only. Fix forward with a new migration. Restore from backup only for data loss (see DATABASE.md).
