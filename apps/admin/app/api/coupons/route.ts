import { createCoupon, listCoupons } from "@ecom/services";
import { apiRoute, readJson, searchParams } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ req, ctx }) => listCoupons(ctx, searchParams(req)));
export const POST = apiRoute(async ({ req, ctx }) => createCoupon(ctx, await readJson(req)), { status: 201 });