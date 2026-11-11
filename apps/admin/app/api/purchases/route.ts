import { createPurchase, listPurchases } from "@ecom/services";
import { apiRoute, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ ctx }) => listPurchases(ctx));
export const POST = apiRoute(async ({ req, ctx }) => createPurchase(ctx, await readJson(req)), { status: 201 });
