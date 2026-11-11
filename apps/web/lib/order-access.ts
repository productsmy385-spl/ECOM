import "server-only";
import type { OrderAccess } from "@ecom/services";
import type { Customer } from "./customer";

const TOKEN = /^[A-Za-z0-9_-]{32}$/; // 24 random bytes, base64url

class NoAccess extends Error {
  readonly status = 404;
  constructor() {
    super("Order not found.");
  }
}

/**
 * Who may see or pay an order: the signed-in customer, or a guest holding the
 * secret token from their order link (passed as `?t=` or `orderToken` in the body).
 */
export async function orderAccess(req: Request | null, customer: Customer | null, body?: Record<string, unknown>, tokenParam?: string | null): Promise<OrderAccess> {
  // A guest-order link still works after the shopper signs in (token access only matches guest orders).
  const token = tokenParam ?? (body?.orderToken as string | undefined) ?? (req ? new URL(req.url).searchParams.get("t") : null);
  if (token && TOKEN.test(token)) return { orderToken: token };
  if (customer) return { customerId: customer.userId };
  throw new NoAccess();
}
