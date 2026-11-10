import { createBrand, listBrandsAdmin } from "@ecom/services";
import { apiRoute, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ ctx }) => listBrandsAdmin(ctx));
export const POST = apiRoute(async ({ req, ctx }) => createBrand(ctx, await readJson(req)), { status: 201 });
