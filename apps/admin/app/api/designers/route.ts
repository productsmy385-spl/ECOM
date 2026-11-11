import { listDesigners } from "@ecom/services";
import { apiRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Staff eligible to be assigned designs (needs designs.assign). */
export const GET = apiRoute(({ ctx }) => listDesigners(ctx));
