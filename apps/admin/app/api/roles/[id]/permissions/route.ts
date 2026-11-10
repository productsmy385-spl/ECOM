import { setRolePermissions } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const PUT = apiRoute<{ id: string }>(async ({ req, ctx, params }) =>
  setRolePermissions(ctx, idParam(params.id), await readJson(req)),
);
