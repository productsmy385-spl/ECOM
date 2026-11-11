import { getAdminAuthState } from "@/lib/session";
import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "../auth-panel";
import { SignOutAction } from "./sign-out-action";

export const metadata: Metadata = { title: "No staff access" };

/** Signed in with Clerk, but not an active staff member. */
export default async function NoAccessPage() {
  const state = await getAdminAuthState();
  if (state.kind === "staff") redirect("/dashboard");
  if (state.kind === "signed-out") redirect("/login");
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <AuthPanel title="No staff access" subtitle="This sign-in isn't linked to an active staff account.">
      <div className="space-y-4 text-sm text-muted-foreground">
        {email && (
          <p>
            You&apos;re signed in as <span className="font-medium text-foreground">{email}</span>.
          </p>
        )}
        <p>
          If you were invited, sign in with the email the invitation was sent to. If your access was removed, ask
          an administrator.
        </p>
        <SignOutAction />
      </div>
    </AuthPanel>
  );
}
