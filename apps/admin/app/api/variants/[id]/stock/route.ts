import { adjustStock } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = apiRoute<{ id: string }>(async ({ req, ctx, params }) =>
  adjustStock(ctx, idParam(params.id), await readJson(req)),
);
