import { createAddress, listAddresses } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";

export const dynamic = "force-dynamic";

export const GET = customerRoute(({ c }) => listAddresses(c));
export const POST = customerRoute(async ({ req, c }) => createAddress(c, await req.json()), { status: 201, limit: 20 });
