import { getCheckoutSettings, updateCheckoutSettings } from "@ecom/services";
import { requirePermission } from "@ecom/rbac";
import { apiRoute, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async ({ ctx }) => {
  requirePermission(ctx.actor, "settings.manage");
  return getCheckoutSettings();
});
export const PUT = apiRoute(async ({ req, ctx }) => updateCheckoutSettings(ctx, await readJson(req)));