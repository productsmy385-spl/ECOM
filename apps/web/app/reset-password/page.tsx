import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const invalid = !token || error === "INVALID_TOKEN" || !/^[A-Za-z0-9_-]{8,200}$/.test(token);
  return (
    <AuthShell title={invalid ? "This link has expired" : "Choose a new password"}>
      {invalid ? (
        <p className="text-sm text-muted-foreground">
          Reset links work once and expire after 30 minutes. <Link href="/forgot-password" className="text-link hover:underline">Request a new link</Link>.
        </p>
      ) : (
        <ResetForm token={token} />
      )}
    </AuthShell>
  );
}
