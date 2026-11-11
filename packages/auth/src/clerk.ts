import { type ClerkClient, createClerkClient, type User } from "@clerk/backend";
import type { ClerkIdentity } from "./identity";

let client: ClerkClient | undefined;

/** Clerk Backend API client, created on first use so builds never need CLERK_SECRET_KEY. */
export function clerk(): ClerkClient {
  if (!client) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");
    client = createClerkClient({ secretKey, publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
  }
  return client;
}

export function identityFromClerkUser(u: Pick<User, "id" | "primaryEmailAddressId" | "emailAddresses" | "firstName" | "lastName" | "imageUrl" | "hasImage">): ClerkIdentity {
  const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return {
    clerkUserId: u.id,
    email: primary?.emailAddress ?? null,
    emailVerified: primary?.verification?.status === "verified",
    name: name || null,
    image: u.hasImage ? u.imageUrl : null,
  };
}

/** Fetches a Clerk user by id; null when it doesn't exist. */
export async function fetchClerkIdentity(clerkUserId: string): Promise<ClerkIdentity | null> {
  try {
    return identityFromClerkUser(await clerk().users.getUser(clerkUserId));
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export type InviteResult = { sent: boolean; alreadyHasAccount?: boolean; error?: string };

/**
 * Sends a Clerk invitation email. Accepting it creates the person's Clerk
 * account; on first sign-in it is linked to the staff row by verified email.
 * Never throws, so a mail/Clerk outage can't roll back an already-created
 * staff account — the UI offers "Resend invitation" instead.
 */
export async function sendClerkInvitation(email: string, redirectUrl: string): Promise<InviteResult> {
  try {
    await clerk().invitations.createInvitation({
      emailAddress: email,
      redirectUrl,
      notify: true,
      ignoreExisting: true,
      expiresInDays: 7,
    });
    return { sent: true };
  } catch (err) {
    const codes = ((err as { errors?: { code?: string }[] }).errors ?? []).map((e) => e.code);
    if (codes.includes("form_identifier_exists") || codes.includes("duplicate_record")) {
      // They already have a Clerk account: they just sign in, and are linked by email.
      return { sent: false, alreadyHasAccount: true };
    }
    console.error("[invite] Clerk invitation failed:", (err as Error).message, codes);
    return { sent: false, error: "The invitation could not be sent. Try resending it." };
  }
}

/** Ends every Clerk session of a user (used when staff are deactivated). Best effort. */
export async function revokeClerkSessions(clerkUserId: string): Promise<number> {
  try {
    const { data } = await clerk().sessions.getSessionList({ userId: clerkUserId, status: "active" });
    await Promise.all(data.map((s) => clerk().sessions.revokeSession(s.id)));
    return data.length;
  } catch (err) {
    console.error("[auth] could not revoke Clerk sessions:", (err as Error).message);
    return 0;
  }
}
