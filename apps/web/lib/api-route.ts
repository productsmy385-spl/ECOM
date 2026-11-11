import "server-only";
import type { DesignOwner } from "@ecom/services";
import { ZodError, z } from "zod";
import { resolveDesignOwner } from "./design-owner";
import { clientIp, rateLimit, tooMany } from "./rate-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Storefront JSON route for design APIs: same-origin writes, rate limit, owner, error mapping. */
export function designRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (args: { req: Request; owner: DesignOwner; params: P }) => Promise<unknown>,
  opts: { createOwner?: boolean; limit?: number; status?: number } = {},
) {
  return async (req: Request, route: { params: Promise<P> }) => {
    const headers = { "Cache-Control": "no-store" };
    try {
      if (req.method !== "GET") {
        const origin = req.headers.get("origin");
        if (origin && origin !== new URL(process.env.WEB_URL ?? "http://localhost:3000").origin) {
          return Response.json({ error: "Cross-origin request rejected." }, { status: 403, headers });
        }
      }
      const rl = rateLimit(`designs:${req.method}:${clientIp(req)}`, opts.limit ?? 60, 60_000);
      if (!rl.ok) return tooMany(rl.retryAfter);

      const params = (route?.params ? await route.params : {}) as P;
      if ("id" in params && !UUID.test(String(params.id))) return Response.json({ error: "Design not found." }, { status: 404, headers });

      const owner = await resolveDesignOwner({ create: !!opts.createOwner });
      if (!owner) return Response.json({ error: "Design not found." }, { status: 404, headers });

      const result = await handler({ req, owner, params });
      return Response.json(result ?? { ok: true }, { status: opts.status ?? 200, headers });
    } catch (err) {
      if (err instanceof ZodError) {
        return Response.json(
          { error: "Please check your choices.", fieldErrors: z.flattenError(err).fieldErrors },
          { status: 422, headers },
        );
      }
      if (err instanceof SyntaxError) return Response.json({ error: "Invalid request." }, { status: 400, headers });
      const e = err as { status?: number; message?: string; fieldErrors?: Record<string, string[]> };
      if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
        return Response.json({ error: e.message, ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}) }, { status: e.status, headers });
      }
      console.error("[designs]", err);
      return Response.json({ error: "Something went wrong. Please try again." }, { status: 500, headers });
    }
  };
}
