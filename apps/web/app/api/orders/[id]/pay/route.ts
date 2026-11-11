import { retryPayment } from "@ecom/services";
import { orderAccess } from "@/lib/order-access";
import { shopRoute } from "@/lib/shop-route";

export const dynamic = "force-dynamic";

export const POST = shopRoute<{ id: string }>(
  async ({ req, customer, params }) => retryPayment(await orderAccess(req, customer), params.id),
  { limit: 10, scope: "pay" },
);