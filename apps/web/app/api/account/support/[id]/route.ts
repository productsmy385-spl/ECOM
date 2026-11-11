import { getMyTicket, replyMyTicket } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";

export const dynamic = "force-dynamic";

export const GET = customerRoute<{ id: string }>(({ c, params }) => getMyTicket(c, params.id));
export const POST = customerRoute<{ id: string }>(async ({ req, c, params }) => replyMyTicket(c, params.id, await req.json()), { limit: 20 });
