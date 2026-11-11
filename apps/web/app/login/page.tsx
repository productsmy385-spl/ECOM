import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { emailEnabled, getCustomer, safeNext } from "@/lib/customer";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  if (await getCustomer()) redirect(dest);
  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your designs, addresses and wishlist."
      footer={
        <>
          New here?{" "}
          <Link href={`/register${next ? `?next=${encodeURIComponent(dest)}` : ""}`} className="font-semibold text-link hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={dest} otpAvailable={emailEnabled()} />
    </AuthShell>
  );
}
