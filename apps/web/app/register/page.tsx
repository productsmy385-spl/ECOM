import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCustomer, safeNext } from "@/lib/customer";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  if (await getCustomer()) redirect(dest);
  return (
    <AuthShell
      title="Create your account"
      subtitle="Save designs across devices, keep addresses and build a wishlist."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login${next ? `?next=${encodeURIComponent(dest)}` : ""}`} className="font-semibold text-link hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm next={dest} />
    </AuthShell>
  );
}
