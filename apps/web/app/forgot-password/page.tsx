import { brand } from "@ecom/ui/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { emailEnabled } from "@/lib/customer";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" footer={<Link href="/login" className="text-link hover:underline">Back to sign in</Link>}>
      {emailEnabled() ? (
        <ForgotForm />
      ) : (
        // Without an email provider a reset link can't be delivered: say so instead of pretending.
        <p className="text-sm text-muted-foreground">
          Password reset by email isn&apos;t available right now. Please contact us at{" "}
          <a className="text-link hover:underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a> and we&apos;ll help you get back in.
        </p>
      )}
    </AuthShell>
  );
}
