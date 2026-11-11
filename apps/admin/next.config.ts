import path from "node:path";
import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// One .env at the monorepo root serves every app locally. Never overrides variables
// already in the environment, so Railway-injected values always win.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  // Admin is served under /admin so the storefront domain can proxy to it, and
  // routes match the spec (/admin/dashboard, /admin/products, ...).
  basePath: "/admin",
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@ecom/auth", "@ecom/db", "@ecom/rbac", "@ecom/services", "@ecom/ui", "@ecom/validation"],
  poweredByHeader: false,
  // The admin only exists under /admin. Anything else on this domain (e.g. the
  // bare domain, or /login) is sent there instead of a 404.
  async redirects() {
    return [
      { source: "/", destination: "/admin", permanent: false, basePath: false },
      { source: "/:path((?!admin(?:/|$)).*)", destination: "/admin/:path", permanent: false, basePath: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
