import { revokeClerkSessions } from "@ecom/auth";
import { setStaffStatus } from "@ecom/services";
import { apiRoute, idParam, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = apiRoute<{ id: string }>(async ({ req, ctx, params }) => {
  const staff = await setStaffStatus(ctx, idParam(params.id), await readJson(req));
  // Our status check already refuses them on every request. Ending their Clerk
  // sessions as well signs them out of the browser instead of leaving them on a
  // "no access" screen.
  if (staff.status === "suspended" && staff.clerkUserId) await revokeClerkSessions(staff.clerkUserId);
  return staff;
});
