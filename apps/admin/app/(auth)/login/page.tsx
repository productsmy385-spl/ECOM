import { getAdminAuthState } from "@/lib/session";
import { SignIn } from "@clerk/nextjs";
import { clerkEmbeddedAppearance } from "@ecom/ui/clerk-appearance";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "../auth-panel";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const state = await getAdminAuthState();
  if (state.kind === "staff") redirect("/dashboard");
  if (state.kind === "no-access") redirect("/no-access");
  return (
    <AuthPanel title="Staff sign in" subtitle="Use the email your administrator invited.">
      <SignIn
        routing="hash"
        fallbackRedirectUrl="/admin/dashboard"
        signUpUrl="/admin/accept-invite"
        appearance={{
          ...clerkEmbeddedAppearance,
          // Staff accounts are created by invitation only.
          elements: { ...clerkEmbeddedAppearance.elements, footerAction: { display: "none" } },
        }}
      />
    </AuthPanel>
  );
}
