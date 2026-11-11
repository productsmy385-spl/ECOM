import { applyCartCoupon, removeCartCoupon } from "@ecom/services";
import { NOBODY, shopRoute } from "@/lib/shop-route";

export const dynamic = "force-dynamic";

// Tight limit: coupon codes must not be guessable by brute force.
export const POST = shopRoute(async ({ req, shopper }) => applyCartCoupon(shopper ?? NOBODY, await req.json()), { limit: 10, scope: "coupon" });
export const DELETE = shopRoute(async ({ shopper }) => removeCartCoupon(shopper ?? NOBODY));