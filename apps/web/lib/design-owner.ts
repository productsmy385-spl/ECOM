import "server-only";
import { randomBytes } from "node:crypto";
import type { DesignOwner } from "@ecom/services";
import { cookies, headers } from "next/headers";
import { getAuth } from "./auth";

/**
 * Who owns designs for this request:
 *  1. a signed-in customer (verified Better Auth session), else
 *  2. an anonymous visitor identified by an httpOnly random token cookie.
 * Never derived from request bodies or query strings.
 */
export const GUEST_COOKIE = "ecom_design_owner";
const TOKEN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export async function resolveDesignOwner({ create }: { create: boolean }): Promise<DesignOwner | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session?.user) return { customerId: session.user.id };

  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing && TOKEN.test(existing)) return { guestToken: existing };
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
