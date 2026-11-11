import { buyAgain } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";

export const dynamic = "force-dynamic";

/** POST — put this order's plain items back in the bag. */
export const POST = customerRoute<{ id: string }>(({ c, params }) => buyAgain(c, params.id), { limit: 20 });
