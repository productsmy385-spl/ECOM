import { getAdminAuthState } from "@/lib/session";
import { SignUp } from "@clerk/nextjs";
import { clerkEmbeddedAppearance } from "@ecom/ui/clerk-appearance";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "../auth-panel";

export const metadata: Metadata = { title: "Accept invitation" };

/**
 * Target of the Clerk invitation email. Clerk appends `__clerk_ticket`, which
 * the SignUp component redeems; the email address is fixed by the invitation.
 */
export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = await getAdminAuthState();
  if (state.kind === "staff") redirect("/dashboard");
  const { __clerk_ticket: ticket } = await searchParams;

  if (!ticket) {
    return (
      <AuthPanel title="Accept your invitation" subtitle="Staff accounts are created by invitation only.">
        <p className="text-sm text-muted-foreground">
          Open the link in your invitation email to set up your sign-in. Already set up?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
          .
        </p>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel title="Accept your invitation" subtitle="Choose how you'll sign in to the admin.">
      <SignUp
        routing="hash"
        fallbackRedirectUrl="/admin/dashboard"
        signInUrl="/admin/login"
        appearance={clerkEmbeddedAppearance}
      />
    </AuthPanel>
  );
}
