import { listSuppliers, saveSupplier } from "@ecom/services";
import { apiRoute, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ ctx }) => listSuppliers(ctx));
export const POST = apiRoute(async ({ req, ctx }) => saveSupplier(ctx, null, await readJson(req)), { status: 201 });
