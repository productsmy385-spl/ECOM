import "server-only";
import { getAuth } from "./auth";

/**
 * Sends the staff invitation / password-set link through Better Auth's reset
 * flow (single-use token, 24 h). Returns false instead of throwing so a mail
 * outage never rolls back an already-created staff account — the UI then
 * offers "Resend invitation".
 */
export async function sendStaffInvite(email: string): Promise<{ sent: boolean; error?: string }> {
  try {
    await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/admin/reset-password" } });
    return { sent: true };
  } catch (err) {
    console.error("[invite] failed to send:", (err as Error).message);
    return { sent: false, error: "The invitation email could not be sent. Try resending it." };
  }
}
