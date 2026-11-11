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
| Set or rotate a secret | `railway variables --service ECOM --set "CLERK_SECRET_KEY=…"`. Do **not** pipe into `--stdin` from Windows PowerShell 5.1: it prefixes a BOM, which corrupts the value. After changing any `NEXT_PUBLIC_*` value, push or rebuild, because a redeploy keeps the old inlined value. |
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

## Payments go-live checklist (Razorpay)
1. Set the keys on the storefront service. Use `--set`, not `--stdin`, in PowerShell:
   `railway variables --service ECOM --set "RAZORPAY_KEY_ID=…" --set "RAZORPAY_KEY_SECRET=…" --set "RAZORPAY_WEBHOOK_SECRET=…"`.
   The admin only checks whether the keys are present, so it can show "configured".
2. In the Razorpay dashboard, add a webhook to `<WEB_URL>/api/webhooks/razorpay` for `payment.captured`, `order.paid` and `payment.failed`, using the same secret.
3. Use test mode first: place an order, pay, and check the order becomes Confirmed. Then switch to live keys.

## Admin URL behaviour
The admin service only serves `/admin/*`. Any other path, including the bare domain, redirects into `/admin` (`apps/admin/next.config.ts`). Fixed 2026-11-11: the bare domain used to 404, and `/admin` returned 500.

## Rollback
- **App**: redeploy the previous deployment in Railway (one click), or `git revert` and push.
- **Infrastructure**: `git revert` the `.railway/railway.ts` change, then `railway config plan` / `apply`.
- **Schema**: migrations are forward-only. Fix forward. Restore from a Postgres backup only for data loss (see DATABASE.md). **Enable scheduled backups on the Postgres service** (not yet done; this needs a dashboard action by the owner).

## Backup and restore
**Drill passed 2026-11-11** `[fact]`. It ran against the local database, so production customer data was not copied to a laptop.
- A `pg_dump -Fc` restored into a new database with `pg_restore --no-owner`.
- Row counts for users, products, orders, stock movements and migrations matched exactly.

Runbook for production:
1. **Owner action (still open):** in Railway, open Postgres → Backups and enable scheduled backups (daily, with weekly retention). Railway restores a backup in place from the same screen.
2. **Manual off-site dump before risky changes**, from a shell that has the public URL:
   - Command: `pg_dump "$DATABASE_PUBLIC_URL" -Fc -f adira-YYYYMMDD.dump`.
   - Store the file encrypted: it contains customer PII.
3. **To restore a dump into a fresh database:**
   - Command: `createdb <new> && pg_restore -d <new> --no-owner adira-YYYYMMDD.dump`.
   - Check row counts against the source.
   - Then point `DATABASE_URL` at it, or restore over the original during a maintenance window.

## Release checklist
- [ ] **Razorpay:** test keys, then live keys and the webhook secret (see above). Then re-run `pnpm e2e` and `scripts/smoke.mjs` against production.
- [ ] **Demo frames:** remove them with `seed:dev-catalog --remove` (OPEN_QUESTIONS #22). Add the real products and photos.
- [ ] **Store settings:** store GSTIN and address in Checkout settings (they appear on invoices). Confirm GST on shipping (open item G).
- [ ] **Backups:** enable scheduled Postgres backups.
- [ ] **Clerk:** production instance and custom domain. Rebuild both apps, because the CSP reads the Clerk host from the publishable key at build time.
- [ ] **Custom domain (optional):** set `WEB_URL`/`ADMIN_URL` explicitly.

## Known gaps
- No custom domain yet. Both apps use `*.up.railway.app`. When adding one, update the `WEB_URL`/`ADMIN_URL` references (they follow `RAILWAY_PUBLIC_DOMAIN`, so a custom domain needs explicit values).
- No email provider, by owner decision (OPEN_QUESTIONS #21). Clerk sends the sign-in and invitation emails; customer order emails are skipped.
- In-memory rate limits are fine for 1 replica each. Move them to Redis before scaling out.
- **Load test not run.** A meaningful one needs a production-like database and payment sandbox. With one replica per app, the current ceiling is unmeasured.
