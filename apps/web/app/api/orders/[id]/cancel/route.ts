import { cancelMyOrder } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST { reason, details? } — the signed-in customer cancels their own order before production. */
export const POST = customerRoute<{ id: string }>(
  async ({ req, c, params }) => cancelMyOrder(c, params.id, await req.json(), { ip: clientIp(req), userAgent: req.headers.get("user-agent") }),
  { limit: 10 },
);
