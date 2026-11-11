import { SignUp } from "@clerk/nextjs";
import { clerkEmbeddedAppearance } from "@ecom/ui/clerk-appearance";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountUnavailable } from "@/components/auth/account-unavailable";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCustomerState, safeNext } from "@/lib/customer";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const state = await getCustomerState();
  if (state.kind === "customer") redirect(dest);
  if (state.kind === "unavailable") return <AccountUnavailable />;
  return (
    <AuthShell title="Create your account" subtitle="Save designs across devices, keep addresses and build a wishlist.">
      <SignUp
        routing="hash"
        forceRedirectUrl={dest}
        signInUrl={`/login?next=${encodeURIComponent(dest)}`}
        signInForceRedirectUrl={dest}
        appearance={clerkEmbeddedAppearance}
      />
    </AuthShell>
  );
}
