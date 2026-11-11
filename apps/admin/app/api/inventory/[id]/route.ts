import { listMovements, setMinStock } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Ledger for one variant. */
export const GET = apiRoute<{ id: string }>(({ ctx, params }) => listMovements(ctx, idParam(params.id)));
export const PATCH = apiRoute<{ id: string }>(async ({ req, ctx, params }) => setMinStock(ctx, idParam(params.id), await readJson(req)));
