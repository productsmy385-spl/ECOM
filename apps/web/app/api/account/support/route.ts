import { createTicket, listMyTickets } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";

export const dynamic = "force-dynamic";

export const GET = customerRoute(({ c }) => listMyTickets(c));
export const POST = customerRoute(async ({ req, c }) => createTicket(c, await req.json()), { status: 201, limit: 5 });
