import { getProfile, updateProfile } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";

export const dynamic = "force-dynamic";

export const GET = customerRoute(({ c }) => getProfile(c));
export const PATCH = customerRoute(async ({ req, c }) => updateProfile(c, await req.json()), { limit: 20 });
