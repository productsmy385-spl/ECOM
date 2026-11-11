import { listMyNotifications, markNotificationsRead } from "@ecom/services";
import { z } from "zod";
import { apiRoute, readJson, searchParams } from "@/lib/api";

export const dynamic = "force-dynamic";

/** The caller's own notifications only (identity from the session). */
export const GET = apiRoute(({ req, ctx }) => {
  const q = searchParams(req) as Record<string, string>;
  return listMyNotifications(ctx.actor.userId, { unreadOnly: q.unread === "true", limit: 30 });
});

const readSchema = z.object({ ids: z.array(z.uuid()).max(100).optional() });
export const POST = apiRoute(async ({ req, ctx }) => {
  const { ids } = readSchema.parse(await readJson(req));
  return markNotificationsRead(ctx.actor.userId, ids);
});