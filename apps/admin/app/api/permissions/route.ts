import { listPermissionCatalogue } from "@ecom/services";
import { apiRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async ({ ctx }) => listPermissionCatalogue(ctx));
