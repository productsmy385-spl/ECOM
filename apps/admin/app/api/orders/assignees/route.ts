import { listOrderAssignees } from "@ecom/services";
import { apiRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ ctx }) => listOrderAssignees(ctx));
