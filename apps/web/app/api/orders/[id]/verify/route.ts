import { verifyRazorpayPayment } from "@ecom/services";
import { orderAccess } from "@/lib/order-access";
import { shopRoute } from "@/lib/shop-route";

export const dynamic = "force-dynamic";

export const POST = shopRoute<{ id: string }>(
  async ({ req, customer, params }) => {
    const body = (await req.json()) as Record<string, unknown>;
    return verifyRazorpayPayment(await orderAccess(req, customer, body), params.id, body);
  },
  { limit: 20, scope: "verify" },
);