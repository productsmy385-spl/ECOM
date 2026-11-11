import { requestReturn } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST { reason, details } — request a return within the return window after delivery. */
export const POST = customerRoute<{ id: string }>(
  async ({ req, c, params }) => requestReturn(c, params.id, await req.json(), { ip: clientIp(req), userAgent: req.headers.get("user-agent") }),
  { limit: 10 },
);
