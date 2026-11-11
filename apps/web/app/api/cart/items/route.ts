import { addToCart } from "@ecom/services";
import { shopRoute } from "@/lib/shop-route";

export const dynamic = "force-dynamic";

export const POST = shopRoute(async ({ req, shopper }) => addToCart(shopper!, await req.json()), { createShopper: true, limit: 40 });