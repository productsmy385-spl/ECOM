import { getCart } from "@ecom/services";
import { NOBODY, shopRoute } from "@/lib/shop-route";

export const dynamic = "force-dynamic";

export const GET = shopRoute(async ({ req, shopper }) => {
  const method = new URL(req.url).searchParams.get("shipping") === "express" ? "express" : "standard";
  return getCart(shopper ?? NOBODY, method);
});