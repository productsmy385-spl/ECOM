"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const confirm = String(f.get("confirm") ?? "");
    const marketing = f.get("marketing") === "on";
    const errs: Errors = {};
    if (!name) errs.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "Enter a valid email address";
    if (password.length < 8) errs.password = "Use at least 8 characters";
    else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) errs.password = "Use both letters and numbers";
    if (confirm !== password) errs.confirm = "Passwords don't match";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setFormError(null);
    const { error } = await authClient.signUp.email({ name, email, password });
    if (error) {
      setBusy(false);
      setFormError(
        error.status === 429
          ? "Too many attempts. Please wait a minute."
          : /exist/i.test(error.message ?? "")
            ? "An account with this email already exists. Sign in instead."
            : (error.message ?? "Couldn't create your account."),
      );
      return;
    }
    // Account created and signed in; record the marketing preference.
    if (marketing) {
      await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, marketingOptIn: true }),
      }).catch(() => {});
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <FormAlert>{formError}</FormAlert>}
      <Field label="Full name" name="name" autoComplete="name" error={errors.name} required />
      <Field label="Email" name="email" type="email" autoComplete="email" error={errors.email} required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters, with letters and numbers." error={errors.password} required />
      <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} required />
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="marketing" className="mt-0.5 h-4 w-4 accent-primary" />
        <span className="text-muted-foreground">Email me about new collections and offers (optional).</span>
      </label>
      <SubmitButton busy={busy}>Create account</SubmitButton>
    </form>
  );
}
