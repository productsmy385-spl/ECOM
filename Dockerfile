# Production image for one app of the monorepo. Build with:
#   docker build --build-arg APP=web   -t ecom-web .
#   docker build --build-arg APP=admin -t ecom-admin .
# On Railway, the service variable APP=web|admin is passed as a build arg.
# Builds need NO database or runtime secrets (pages render at request time).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- dependencies (cached unless manifests change) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Every workspace manifest, so the frozen lockfile installs all importers.
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/rbac/package.json packages/rbac/
COPY packages/services/package.json packages/services/
COPY packages/ui/package.json packages/ui/
COPY packages/validation/package.json packages/validation/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
ARG APP=web
# NEXT_PUBLIC_* values are inlined into the bundles at build time.
ARG NEXT_PUBLIC_BRAND_NAME
ARG NEXT_PUBLIC_SUPPORT_EMAIL
# Clerk's publishable key is public (it ships to browsers) but Clerk reads it at build time.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BRAND_NAME=${NEXT_PUBLIC_BRAND_NAME} \
    NEXT_PUBLIC_SUPPORT_EMAIL=${NEXT_PUBLIC_SUPPORT_EMAIL} \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm --filter @ecom/db bundle && pnpm --filter "@ecom/${APP}" build

# ---- runtime ----
FROM node:22-alpine AS runner
ARG APP=web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    APP=${APP} \
    MIGRATIONS_DIR=/app/migrations
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
# Static files (demo artwork, icons). Standalone output does not include public/.
COPY --from=build --chown=app:app /repo/apps/${APP}/public ./apps/${APP}/public
# Migration + seed runners (self-contained bundles) and the SQL migrations.
COPY --from=build --chown=app:app /repo/packages/db/dist ./db
COPY --from=build --chown=app:app /repo/packages/db/migrations ./migrations
USER app
EXPOSE 3000
CMD ["sh", "-c", "node apps/${APP}/server.js"]
