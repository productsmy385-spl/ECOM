import "server-only";
import { AuthenticationError, AuthorizationError, type ServiceContext } from "@ecom/services";
import { ZodError, z } from "zod";
import { getStaffSession } from "./session";

/** 400 for malformed requests (bad JSON etc.). */
export class BadRequestError extends Error {
  readonly status = 400;
}

type RouteArgs<P> = { req: Request; ctx: ServiceContext; params: P };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

/**
 * CSRF defence for cookie-authenticated, state-changing requests: a browser
 * always sends Origin on cross-site POST/PATCH/PUT/DELETE, so a foreign Origin
 * is rejected. Requests without Origin (server-to-server, native apps) pass.
 */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const allowed = new URL(process.env.ADMIN_URL ?? "http://localhost:3001").origin;
  if (origin !== allowed) throw new AuthorizationError("Cross-origin request rejected.");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON.");
  }
}

export function searchParams(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams);
}

/** Path ids that are not UUIDs can never exist → 404 (and no DB cast error). */
export function idParam(id: string | undefined): string {
  if (!id || !UUID.test(id)) throw Object.assign(new Error("Not found."), { status: 404 });
  return id;
}

function errorResponse(err: unknown): Response {
  const headers = { "Cache-Control": "no-store" };
  if (err instanceof ZodError) {
    return Response.json(
      { error: "Please correct the highlighted fields.", fieldErrors: z.flattenError(err).fieldErrors },
      { status: 422, headers },
    );
  }
  const e = err as { status?: number; message?: string; fieldErrors?: Record<string, string[]> };
  if (typeof e?.status === "number" && e.status >= 400 && e.status < 500) {
    return Response.json(
      { error: e.message || "Request failed.", ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}) },
      { status: e.status, headers },
    );
  }
  console.error("[api] unhandled error:", err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500, headers });
}

/**
 * Wraps an admin API handler: staff session → ServiceContext → handler → JSON.
 * Permission checks live in the services (defence in depth: the same checks
 * apply to any future caller, e.g. a mobile API).
 */
export function apiRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (args: RouteArgs<P>) => Promise<unknown>,
  opts: { status?: number } = {},
) {
  return async (req: Request, route: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      const session = await getStaffSession();
      if (!session) throw new AuthenticationError();
      const ctx: ServiceContext = {
        actor: session.actor,
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      };
      const params = (route?.params ? await route.params : {}) as P;
      const result = await handler({ req, ctx, params });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true }, {
        status: opts.status ?? 200,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
