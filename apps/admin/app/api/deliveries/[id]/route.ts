import { getDelivery, updateDelivery } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(({ ctx, params }) => getDelivery(ctx, idParam(params.id)));
/** Captain / manager actions: picked_up, out_for_delivery, delivered, failed, reattempt. */
export const POST = apiRoute<{ id: string }>(async ({ req, ctx, params }) => updateDelivery(ctx, idParam(params.id), await readJson(req)));