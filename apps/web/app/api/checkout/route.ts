import { placeOrder } from "@ecom/services";
import { NOBODY, shopRoute } from "@/lib/shop-route";

export const dynamic = "force-dynamic";

export const POST = shopRoute(
  async ({ req, shopper, customer }) =>
    placeOrder(shopper ?? NOBODY, await req.json(), {
      customer: customer ? { userId: customer.userId, email: customer.email, name: customer.name } : null,
    }),
  { limit: 10, scope: "checkout", status: 201 },
);