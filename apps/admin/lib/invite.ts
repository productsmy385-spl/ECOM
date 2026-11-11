import "server-only";
import { type InviteResult, sendClerkInvitation } from "@ecom/auth";

/**
 * Sends the staff invitation through Clerk (Clerk delivers the email). The link
 * opens /admin/accept-invite, where the person creates their sign-in; their
 * first sign-in links it to the staff record by verified email.
 * Never throws: a failure leaves the staff record in place and the UI offers
 * "Resend invitation".
 */
export async function sendStaffInvite(email: string): Promise<InviteResult> {
  const adminUrl = process.env.ADMIN_URL;
  if (!adminUrl) return { sent: false, error: "ADMIN_URL is not configured." };
  return sendClerkInvitation(email, new URL("/admin/accept-invite", adminUrl).toString());
}
