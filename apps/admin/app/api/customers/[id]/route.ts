import { getCustomerAdmin } from "@ecom/services";
import { apiRoute, idParam } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(({ ctx, params }) => getCustomerAdmin(ctx, idParam(params.id)));
