import "server-only";
import type { CustomerContext } from "@ecom/services";
import { ZodError, z } from "zod";
import { getCustomer } from "./customer";
import { clientIp, rateLimit, tooMany } from "./rate-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** JSON route for /api/account/*: signed-in customer only, same-origin writes, rate limited. */
export function customerRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (args: { req: Request; c: CustomerContext; params: P }) => Promise<unknown>,
  opts: { status?: number; limit?: number } = {},
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
      const rl = rateLimit(`account:${req.method}:${clientIp(req)}`, opts.limit ?? 60, 60_000);
      if (!rl.ok) return tooMany(rl.retryAfter);
      const customer = await getCustomer();
      if (!customer) return Response.json({ error: "Please sign in." }, { status: 401, headers });
      const params = (route?.params ? await route.params : {}) as P;
      if ("id" in params && !UUID.test(String(params.id))) return Response.json({ error: "Not found." }, { status: 404, headers });
      const result = await handler({ req, c: { userId: customer.userId }, params });
      return Response.json(result ?? { ok: true }, { status: opts.status ?? 200, headers });
    } catch (err) {
      if (err instanceof ZodError) {
        return Response.json({ error: "Please check the highlighted fields.", fieldErrors: z.flattenError(err).fieldErrors }, { status: 422, headers });
      }
      if (err instanceof SyntaxError) return Response.json({ error: "Invalid request." }, { status: 400, headers });
      const e = err as { status?: number; message?: string };
      if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
        return Response.json({ error: e.message }, { status: e.status, headers });
      }
      console.error("[account]", err);
      return Response.json({ error: "Something went wrong. Please try again." }, { status: 500, headers });
    }
  };
}
