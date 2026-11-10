import { createRole, listRoles } from "@ecom/services";
import { apiRoute, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ ctx }) => listRoles(ctx));

export const POST = apiRoute(async ({ req, ctx }) => createRole(ctx, await readJson(req)), { status: 201 });
