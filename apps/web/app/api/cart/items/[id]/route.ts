import { removeCartItem, updateCartItem } from "@ecom/services";
import { NOBODY, shopRoute } from "@/lib/shop-route";

export const dynamic = "force-dynamic";

export const PATCH = shopRoute<{ id: string }>(async ({ req, shopper, params }) => updateCartItem(shopper ?? NOBODY, params.id, await req.json()));
export const DELETE = shopRoute<{ id: string }>(async ({ shopper, params }) => removeCartItem(shopper ?? NOBODY, params.id));