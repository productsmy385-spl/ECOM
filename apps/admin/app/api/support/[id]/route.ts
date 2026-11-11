import { getTicketAdmin, replyTicketAdmin, updateTicket } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(({ ctx, params }) => getTicketAdmin(ctx, idParam(params.id)));
/** POST { message, internal? } — reply to the customer or add an internal note. */
export const POST = apiRoute<{ id: string }>(async ({ req, ctx, params }) => replyTicketAdmin(ctx, idParam(params.id), await readJson(req)));
/** PATCH { status?, priority?, assignedTo? } */
export const PATCH = apiRoute<{ id: string }>(async ({ req, ctx, params }) => updateTicket(ctx, idParam(params.id), await readJson(req)));
