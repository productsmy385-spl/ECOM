import { listReviewsAdmin } from "@ecom/services";
import { apiRoute, searchParams } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ req, ctx }) => listReviewsAdmin(ctx, searchParams(req)));
