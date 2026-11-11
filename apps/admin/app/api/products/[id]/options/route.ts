import { listProductOptions, saveProductOptions } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(({ ctx, params }) => listProductOptions(ctx, idParam(params.id)));
export const PUT = apiRoute<{ id: string }>(async ({ req, ctx, params }) =>
  saveProductOptions(ctx, idParam(params.id), await readJson(req)),
);
