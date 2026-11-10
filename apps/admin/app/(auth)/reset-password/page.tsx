import type { Metadata } from "next";
import Link from "next/link";
import { AuthPanel } from "../auth-panel";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set your password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const invalid = !token || error === "INVALID_TOKEN";

  return (
    <AuthPanel
      title={invalid ? "This link has expired" : "Set your password"}
      subtitle={invalid ? "Links work once and expire after 24 hours." : "Choose a password you don't use anywhere else."}
    >
      {invalid ? (
        <p className="text-sm">
          Ask your administrator to resend your invitation, or{" "}
          <Link href="/forgot-password" className="text-link hover:underline">
            request a new reset link
          </Link>
          .
        </p>
      ) : (
        <ResetForm token={token} />
      )}
    </AuthPanel>
  );
}
