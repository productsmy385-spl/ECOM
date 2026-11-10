import { deleteRole, updateRole } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const PATCH = apiRoute<{ id: string }>(async ({ req, ctx, params }) =>
  updateRole(ctx, idParam(params.id), await readJson(req)),
);

export const DELETE = apiRoute<{ id: string }>(async ({ ctx, params }) => {
  await deleteRole(ctx, idParam(params.id));
  return { ok: true };
});
