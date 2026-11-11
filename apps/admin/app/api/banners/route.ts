import { createBanner, listBanners } from "@ecom/services";
import { apiRoute, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ ctx }) => listBanners(ctx));
export const POST = apiRoute(async ({ req, ctx }) => createBanner(ctx, await readJson(req)), { status: 201 });
