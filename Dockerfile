# Production image for one app of the monorepo. Build with:
#   docker build --build-arg APP=web   -t ecom-web .
#   docker build --build-arg APP=admin -t ecom-admin .
# On Railway, set the service variable APP=web|admin (Railway passes declared ARGs).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- dependencies (cached unless manifests change) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/rbac/package.json packages/rbac/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
ARG APP=web
COPY . .
# Runtime secrets are NOT needed at build time (auth is created lazily).
ENV NEXT_TELEMETRY_DISABLED=1
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
# Migration + seed runners (self-contained bundles) and the SQL migrations.
COPY --from=build --chown=app:app /repo/packages/db/dist ./db
COPY --from=build --chown=app:app /repo/packages/db/migrations ./migrations
USER app
EXPOSE 3000
CMD ["sh", "-c", "node apps/${APP}/server.js"]
