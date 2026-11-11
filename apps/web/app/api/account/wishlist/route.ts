import { addToWishlist, listWishlist, removeFromWishlist } from "@ecom/services";
import { customerRoute } from "@/lib/customer-route";

export const dynamic = "force-dynamic";

export const GET = customerRoute(({ c }) => listWishlist(c));
export const POST = customerRoute(async ({ req, c }) => addToWishlist(c, await req.json()), { limit: 60 });
export const DELETE = customerRoute(async ({ req, c }) => removeFromWishlist(c, await req.json()), { limit: 60 });
