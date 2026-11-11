import { actOnPurchase, getPurchase } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(({ ctx, params }) => getPurchase(ctx, idParam(params.id)));
export const POST = apiRoute<{ id: string }>(async ({ req, ctx, params }) => actOnPurchase(ctx, idParam(params.id), await readJson(req)));
