"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) return setError("Use at least 8 characters with letters and numbers.");
    if (password !== String(f.get("confirm") ?? "")) return setError("Passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (error) return setError(error.status === 400 ? "This link has expired or was already used." : (error.message ?? "Couldn't reset your password."));
    router.replace("/login?reset=1");
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters, with letters and numbers." required />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
      <SubmitButton busy={busy}>Set new password</SubmitButton>
    </form>
  );
}
