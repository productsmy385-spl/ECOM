export { AuthenticationError, AuthorizationError } from "@ecom/rbac";

/** 404 — also used when a record exists but the actor may not see it (IDOR). */
export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** 409 — the request conflicts with current state (duplicate, in use, last super admin...). */
export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/** 422 — business-rule validation that Zod cannot express (e.g. unknown role id). */
export class ValidationError extends Error {
  readonly status = 422;
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Postgres unique_violation, unwrapped from Drizzle's error wrapper. */
export function uniqueViolation(err: unknown): { constraint?: string } | null {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  if (e?.code === "23505") return { constraint: e.constraint };
  if (e?.cause?.code === "23505") return { constraint: e.cause.constraint };
  return null;
}
