"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setPending(false);
      // Server messages are deliberately generic (no account enumeration).
      setError(
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : error.status === 403
            ? (error.message ?? "This account does not have staff access.")
            : "Incorrect email or password.",
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Input label="Email" name="email" type="email" autoComplete="username" required placeholder="you@company.com" />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      <div className="-mt-1 text-right text-sm">
        <Link href="/forgot-password" className="text-link hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" size="lg" isLoading={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
