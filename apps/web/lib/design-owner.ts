import "server-only";
import { randomBytes } from "node:crypto";
import { claimGuestDesigns, type DesignOwner, mergeGuestCart } from "@ecom/services";
import { cookies } from "next/headers";
import { getCustomer } from "./customer";

/**
 * Who owns designs AND the cart for this request (the "shopper"):
 *  1. a signed-in customer (verified Clerk session → our users.id), else
 *  2. an anonymous visitor identified by an httpOnly random token cookie.
 * Never derived from request bodies or query strings.
 *
 * When a visitor with guest designs or a guest cart signs in, both are moved
 * to the account on their next request that resolves the shopper (idempotent).
 */
export const GUEST_COOKIE = "ecom_design_owner";
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export async function resolveDesignOwner({ create }: { create: boolean }): Promise<DesignOwner | null> {
  const customer = await getCustomer();
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  const guestToken = existing && TOKEN.test(existing) ? existing : null;

  if (customer) {
    if (guestToken) {
      await claimGuestDesigns(customer.userId, guestToken);
      await mergeGuestCart(customer.userId, guestToken);
      try {
        jar.delete(GUEST_COOKIE); // allowed in route handlers; ignored during page render
      } catch {
        /* rendering a page: the cookie is harmless and cleared on the next API call */
      }
    }
    return { customerId: customer.userId };
  }

  if (guestToken) return { guestToken };
  if (!create) return null;

  const token = randomBytes(32).toString("base64url");
  jar.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { guestToken: token };
}

/** Alias: the same identity owns the cart. */
export const resolveShopper = resolveDesignOwner;
