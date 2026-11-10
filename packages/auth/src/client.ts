"use client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. Same-origin: each app talks to its own auth route.
 * web → /api/auth, admin (Next basePath "/admin") → /admin/api/auth.
 */
export function makeAuthClient(basePath: "/api/auth" | "/admin/api/auth") {
  return createAuthClient({ basePath, plugins: [emailOTPClient()] });
}
