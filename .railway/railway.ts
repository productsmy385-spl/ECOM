/**
 * Railway infrastructure for this repo (replaces railway.toml / railway.admin.toml).
 *
 *   railway config plan    # preview (safe)
 *   railway config apply   # apply after reviewing the plan
 *
 * Windows note: the SDK's CLI version check can't run the npm shim; set
 *   $env:_ = "$env:APPDATA\npm\node_modules\@railway\cli\bin\railway.exe"
 * before running plan/apply (see knowledge-base/DEPLOYMENT.md).
 *
 * This is a named PARTIAL: it manages only the two app services below and
 * never the Postgres database, which is referenced by name only.
 *
 * Secrets are never written here. They use preserve() and are set with:
 *   railway variables --service ECOM --set "BETTER_AUTH_SECRET=…"
 */
import { defineRailway, github, preserve, project, service } from "railway/iac";

// This repository manages only its own resources in the environment.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "ECOM";

const REPO = "productsmy385-spl/ECOM";

/** Variables both apps share. `${{…}}` are Railway references resolved at deploy time. */
const shared = {
  // Private-network URL of the existing Postgres service (no egress, no TLS needed).
  DATABASE_URL: "${{Postgres.DATABASE_URL}}",
  DATABASE_POOL_MAX: "10",
  // Public origins; also the CSRF allow-list for auth.
  WEB_URL: "https://${{ECOM.RAILWAY_PUBLIC_DOMAIN}}",
  ADMIN_URL: "https://${{admin.RAILWAY_PUBLIC_DOMAIN}}",
  // Inlined at build time (declared as Docker build args).
  NEXT_PUBLIC_BRAND_NAME: "Crimsonne",
  NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.com",
  EMAIL_FROM: "Crimsonne <no-reply@example.com>",
};

export default defineRailway(() => {
  // Storefront. The only service that runs migrations (once per deploy, before traffic).
  const ECOM = service("ECOM", {
    source: github(REPO, { branch: "main", checkSuites: false }),
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: ["apps/web/**", "packages/**", "Dockerfile", "pnpm-lock.yaml", ".railway/**"],
    },
    healthcheck: "/api/health",
    healthcheckTimeout: 60,
    preDeploy: "node db/migrate.mjs",
    replicas: { "asia-southeast1-eqsg3a": 1 },
    networking: { privateNetworkEndpoint: "ecom" },
    variables: {
      ...shared,
      APP: "web",
      // Set out-of-band (never committed).
      BETTER_AUTH_SECRET: preserve(),
      RESEND_API_KEY: preserve(),
      SEED_SUPERADMIN_EMAIL: preserve(),
      SEED_SUPERADMIN_PASSWORD: preserve(),
      SEED_SUPERADMIN_NAME: preserve(),
      IMAGEKIT_PUBLIC_KEY: preserve(),
      IMAGEKIT_PRIVATE_KEY: preserve(),
      IMAGEKIT_URL_ENDPOINT: preserve(),
    },
  });

  // Admin dashboard (Next basePath /admin). No migrations here.
  const admin = service("admin", {
    source: github(REPO, { branch: "main", checkSuites: false }),
    build: {
      buildEnvironment: "V3",
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: ["apps/admin/**", "packages/**", "Dockerfile", "pnpm-lock.yaml", ".railway/**"],
    },
    healthcheck: "/admin/api/health",
    healthcheckTimeout: 60,
    replicas: { "asia-southeast1-eqsg3a": 1 },
    networking: { privateNetworkEndpoint: "admin" },
    variables: {
      ...shared,
      APP: "admin",
      // Must equal the storefront's values: referenced, never copied.
      BETTER_AUTH_SECRET: "${{ECOM.BETTER_AUTH_SECRET}}",
      RESEND_API_KEY: "${{ECOM.RESEND_API_KEY}}",
      IMAGEKIT_PUBLIC_KEY: "${{ECOM.IMAGEKIT_PUBLIC_KEY}}",
      IMAGEKIT_PRIVATE_KEY: "${{ECOM.IMAGEKIT_PRIVATE_KEY}}",
      IMAGEKIT_URL_ENDPOINT: "${{ECOM.IMAGEKIT_URL_ENDPOINT}}",
    },
  });

  return project("zippy-joy", {
    variables: { managed: true },
    resources: [ECOM, admin],
  });
});
