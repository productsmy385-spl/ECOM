import { prepareStaffInvite } from "@ecom/services";
import { apiRoute, idParam } from "@/lib/api";
import { sendStaffInvite } from "@/lib/invite";

export const dynamic = "force-dynamic";

export const POST = apiRoute<{ id: string }>(async ({ ctx, params }) => {
  const { email } = await prepareStaffInvite(ctx, idParam(params.id));
  return sendStaffInvite(email);
});
