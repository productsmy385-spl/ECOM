import { createStaff, listStaff } from "@ecom/services";
import { apiRoute, readJson, searchParams } from "@/lib/api";
import { sendStaffInvite } from "@/lib/invite";

export const dynamic = "force-dynamic";

export const GET = apiRoute(({ req, ctx }) => listStaff(ctx, searchParams(req)));

export const POST = apiRoute(
  async ({ req, ctx }) => {
    const staff = await createStaff(ctx, await readJson(req));
    const invite = await sendStaffInvite(staff.email);
    return { staff, invite };
  },
  { status: 201 },
);
