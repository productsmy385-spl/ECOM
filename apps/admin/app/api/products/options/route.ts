import { catalogFormOptions } from "@ecom/services";
import { apiRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Category + brand choices for product forms and filters. */
export const GET = apiRoute(({ ctx }) => catalogFormOptions(ctx));
