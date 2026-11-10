import { createCategory, listCategoriesAdmin } from "@ecom/services";
import { apiRoute, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ ctx }) => listCategoriesAdmin(ctx));
export const POST = apiRoute(async ({ req, ctx }) => createCategory(ctx, await readJson(req)), { status: 201 });
