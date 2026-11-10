import { createProduct, listProductsAdmin } from "@ecom/services";
import { apiRoute, readJson, searchParams } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ req, ctx }) => listProductsAdmin(ctx, searchParams(req)));
export const POST = apiRoute(async ({ req, ctx }) => createProduct(ctx, await readJson(req)), { status: 201 });
