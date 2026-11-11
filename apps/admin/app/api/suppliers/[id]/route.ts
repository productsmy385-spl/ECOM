import { saveSupplier } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const PATCH = apiRoute<{ id: string }>(async ({ req, ctx, params }) => saveSupplier(ctx, idParam(params.id), await readJson(req)));
