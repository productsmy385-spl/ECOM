import { getStaff, updateStaff } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(({ ctx, params }) => getStaff(ctx, idParam(params.id)));

export const PATCH = apiRoute<{ id: string }>(async ({ req, ctx, params }) =>
  updateStaff(ctx, idParam(params.id), await readJson(req)),
);
