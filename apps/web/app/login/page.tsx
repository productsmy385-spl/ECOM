import { SignIn } from "@clerk/nextjs";
import { clerkEmbeddedAppearance } from "@ecom/ui/clerk-appearance";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountUnavailable } from "@/components/auth/account-unavailable";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCustomerState, safeNext } from "@/lib/customer";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const state = await getCustomerState();
  if (state.kind === "customer") redirect(dest);
  if (state.kind === "unavailable") return <AccountUnavailable />;
  return (
    <AuthShell title="Sign in" subtitle="Access your designs, addresses and wishlist.">
      <SignIn
        routing="hash"
        forceRedirectUrl={dest}
        signUpUrl={`/register?next=${encodeURIComponent(dest)}`}
        signUpForceRedirectUrl={dest}
        appearance={clerkEmbeddedAppearance}
      />
    </AuthShell>
  );
}
