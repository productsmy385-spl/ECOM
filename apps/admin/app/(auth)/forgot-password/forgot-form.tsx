"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ForgotForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/admin/reset-password" });
    setPending(false);
    if (error?.status === 429) {
      setError("Too many requests. Please wait a few minutes.");
      return;
    }
    // Same response whether or not the account exists (no account enumeration).
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div role="status" className="flex gap-3 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p>If that email belongs to a staff account, a reset link is on its way. It works once and expires in 24 hours.</p>
        </div>
        <Link href="/login" className="text-sm text-link hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input label="Email" name="email" type="email" autoComplete="username" required error={error ?? undefined} />
      <Button type="submit" className="w-full" size="lg" isLoading={pending}>
        Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-link hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
