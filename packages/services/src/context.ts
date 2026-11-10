import type { Actor } from "@ecom/rbac";

/**
 * Everything a service needs to know about the caller. Built by the route
 * handler from the VERIFIED session — never from request input.
 */
export interface ServiceContext {
  actor: Actor;
  ip?: string | null;
  userAgent?: string | null;
}
