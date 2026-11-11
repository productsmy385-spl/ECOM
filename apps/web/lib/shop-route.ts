import "server-only";
import type { Shopper } from "@ecom/services";
import { ZodError, z } from "zod";
import { type Customer, getCustomer } from "./customer";
import { resolveShopper } from "./design-owner";
import { clientIp, rateLimit, tooMany } from "./rate-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Storefront JSON route for cart / checkout / order APIs: same-origin writes,
 * per-IP rate limit, shopper (customer or guest cookie) from the session, and
 * consistent error mapping. `shopper` is null only when `createShopper` is
 * false and the visitor has no identity yet.
 */
export function shopRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (args: { req: Request; shopper: Shopper | null; customer: Customer | null; params: P }) => Promise<unknown>,
  opts: { createShopper?: boolean; limit?: number; status?: number; scope?: string } = {},
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
      const rl = rateLimit(`${opts.scope ?? "shop"}:${req.method}:${clientIp(req)}`, opts.limit ?? 60, 60_000);
      if (!rl.ok) return tooMany(rl.retryAfter);

      const params = (route?.params ? await route.params : {}) as P;
      if ("id" in params && !UUID.test(String(params.id))) return Response.json({ error: "Not found." }, { status: 404, headers });

      const shopper = await resolveShopper({ create: !!opts.createShopper });
      const customer = await getCustomer();
      const result = await handler({ req, shopper, customer, params });
      return Response.json(result ?? { ok: true }, { status: opts.status ?? 200, headers });
    } catch (err) {
      if (err instanceof ZodError) {
        return Response.json({ error: "Please check the highlighted fields.", fieldErrors: z.flattenError(err).fieldErrors }, { status: 422, headers });
      }
      if (err instanceof SyntaxError) return Response.json({ error: "Invalid request." }, { status: 400, headers });
      const e = err as { status?: number; message?: string; fieldErrors?: Record<string, string[]> };
      if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
        return Response.json({ error: e.message, ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}) }, { status: e.status, headers });
      }
      if (e.status === 502) return Response.json({ error: "The payment service didn't respond. Please try again." }, { status: 502, headers });
      console.error("[shop]", err);
      return Response.json({ error: "Something went wrong. Please try again." }, { status: 500, headers });
    }
  };
}

/** A shopper that never matches anything: lets signed-out, cookieless visitors read an empty cart. */
export const NOBODY: Shopper = { guestToken: "-".repeat(43) };
