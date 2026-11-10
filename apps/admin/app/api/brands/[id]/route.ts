import { deleteBrand, updateBrand } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const PATCH = apiRoute<{ id: string }>(async ({ req, ctx, params }) =>
  updateBrand(ctx, idParam(params.id), await readJson(req)),
);
export const DELETE = apiRoute<{ id: string }>(async ({ ctx, params }) => {
  await deleteBrand(ctx, idParam(params.id));
  return { ok: true };
});
