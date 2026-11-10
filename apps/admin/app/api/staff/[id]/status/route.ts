import { setStaffStatus } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = apiRoute<{ id: string }>(async ({ req, ctx, params }) =>
  setStaffStatus(ctx, idParam(params.id), await readJson(req)),
);
