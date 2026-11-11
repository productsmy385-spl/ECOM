import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export interface Customer {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

/** The signed-in shopper for this request, from the verified session cookie. */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
  };
});

/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeNext(next: string | undefined | null, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next.slice(0, 500);
}

export async function requireCustomer(returnTo: string): Promise<Customer> {
  const c = await getCustomer();
  if (!c) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return c;
}

/**
 * Email (OTP codes, password resets) only works when Resend is configured.
 * In development, emails are printed to the server log instead.
 */
export const emailEnabled = () => !!process.env.RESEND_API_KEY || process.env.NODE_ENV !== "production";
