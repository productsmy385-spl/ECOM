import { deleteBanner, getBanner, updateBanner } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(({ ctx, params }) => getBanner(ctx, idParam(params.id)));
export const PUT = apiRoute<{ id: string }>(async ({ req, ctx, params }) => updateBanner(ctx, idParam(params.id), await readJson(req)));
export const DELETE = apiRoute<{ id: string }>(async ({ ctx, params }) => {
  await deleteBanner(ctx, idParam(params.id));
  return { ok: true };
});
