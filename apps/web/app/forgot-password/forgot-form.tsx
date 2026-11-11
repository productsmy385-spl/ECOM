"use client";

import { useState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

export function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    if (error?.status === 429) return setError("Too many requests. Please wait a few minutes.");
    setSent(true); // same message whether or not the account exists
  }

  if (sent) return <FormAlert tone="ok">If an account exists for that email, a reset link is on its way. It works once and expires in 30 minutes.</FormAlert>;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      {error && <FormAlert>{error}</FormAlert>}
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <SubmitButton busy={busy}>Send reset link</SubmitButton>
    </form>
  );
}
