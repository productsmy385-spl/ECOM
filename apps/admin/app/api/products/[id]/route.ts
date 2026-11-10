import { deleteProduct, getProductAdmin, updateProduct } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(({ ctx, params }) => getProductAdmin(ctx, idParam(params.id)));
export const PUT = apiRoute<{ id: string }>(async ({ req, ctx, params }) =>
  updateProduct(ctx, idParam(params.id), await readJson(req)),
);
export const DELETE = apiRoute<{ id: string }>(async ({ ctx, params }) => {
  await deleteProduct(ctx, idParam(params.id));
  return { ok: true };
});
