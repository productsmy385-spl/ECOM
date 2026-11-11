import path from "node:path";
import { existsSync } from "node:fs";
import type { NextConfig } from "next";
import { securityHeaders as webSecurityHeaders } from "../../packages/ui/src/security-headers";

// One .env at the monorepo root serves every app locally. Never overrides variables
// already in the environment, so Railway-injected values always win.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const securityHeaders = webSecurityHeaders("web");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@ecom/auth", "@ecom/db", "@ecom/rbac", "@ecom/services", "@ecom/ui", "@ecom/validation"],
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "ik.imagekit.io" }],
    // Our own demo artwork is SVG (public/demo). Served sandboxed, never inline.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
