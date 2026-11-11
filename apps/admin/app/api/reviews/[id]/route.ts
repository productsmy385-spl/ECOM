import { moderateReview } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST { decision: "approved" | "rejected" } */
export const POST = apiRoute<{ id: string }>(async ({ req, ctx, params }) => moderateReview(ctx, idParam(params.id), await readJson(req)));
