import { getWebsiteSettings, updateWebsiteSettings } from "@ecom/services";
import { requirePermission } from "@ecom/rbac";
import { apiRoute, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async ({ ctx }) => {
  requirePermission(ctx.actor, "settings.manage");
  return getWebsiteSettings();
});
export const PUT = apiRoute(async ({ req, ctx }) => updateWebsiteSettings(ctx, await readJson(req)));
