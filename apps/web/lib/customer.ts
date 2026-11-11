import "server-only";
import { fetchClerkIdentity, resolveClerkUser } from "@ecom/auth";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";

export interface Customer {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

export type CustomerState =
  | { kind: "signed-out" }
  /** Signed in with Clerk, but the account can't be used here (suspended, closed, unverified email). */
  | { kind: "unavailable" }
  | { kind: "customer"; customer: Customer };

/**
 * The shopper for this request. Clerk verifies the session; the user id used
 * everywhere else is OUR users.id, resolved from the Clerk user (linked or
 * created on first sign-in), never taken from request input.
 */
export const getCustomerState = cache(async (): Promise<CustomerState> => {
  const { userId } = await auth();
  if (!userId) return { kind: "signed-out" };
  const u = await resolveClerkUser(userId, () => fetchClerkIdentity(userId));
  if (!u || u.status !== "active") return { kind: "unavailable" };
  return { kind: "customer", customer: { userId: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified } };
});

export const getCustomer = cache(async (): Promise<Customer | null> => {
  const s = await getCustomerState();
  return s.kind === "customer" ? s.customer : null;
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
