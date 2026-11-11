import { revokeClerkSessions } from "@ecom/auth";
import { setCustomerStatus } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = apiRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const r = await setCustomerStatus(ctx, idParam(params.id), await readJson(req));
  if (r.status === "suspended" && r.clerkUserId) await revokeClerkSessions(r.clerkUserId);
  return { id: r.id, status: r.status };
});
