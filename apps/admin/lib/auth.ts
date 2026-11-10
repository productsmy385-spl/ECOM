import "server-only";
import { type Auth, createAuth } from "@ecom/auth";

let instance: Auth | undefined;

/**
 * Created on first use, not at import: `next build` imports route modules to
 * collect metadata, and runtime secrets (BETTER_AUTH_SECRET, ADMIN_URL) are not
 * available — and must not be required — at build time.
 */
export function getAuth(): Auth {
  instance ??= createAuth("admin");
  return instance;
}
