"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormAlert, SubmitButton } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const EMAIL = /^\S+@\S+\.\S+$/;

export function LoginForm({ next, otpAvailable }: { next: string; otpAvailable: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  const done = () => {
    router.replace(next);
    router.refresh();
  };
  const friendly = (status?: number, msg?: string) =>
    status === 429 ? "Too many attempts. Please wait a minute and try again." : status === 403 ? (msg ?? "This account can't sign in.") : null;

  async function withPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (!EMAIL.test(email) || !password) return setError("Enter your email and password.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(friendly(error.status, error.message) ?? "Incorrect email or password.");
    done();
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!EMAIL.test(email)) return setError("Enter a valid email address.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setBusy(false);
    if (error) return setError(friendly(error.status, error.message) ?? "Couldn't send a code. Please try again.");
    setCodeSent(true);
  }

  async function withCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const otp = String(new FormData(e.currentTarget).get("otp") ?? "").replace(/\D/g, "");
    if (otp.length !== 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp });
    setBusy(false);
    if (error) return setError(friendly(error.status, error.message) ?? "That code is wrong or has expired.");
    done();
  }

  return (
    <div className="space-y-5">
      {otpAvailable && (
        <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium" role="tablist" aria-label="Sign-in method">
          {(["password", "code"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn("rounded-md py-2", mode === m ? "bg-white shadow-card" : "text-muted-foreground")}
            >
              {m === "password" ? "Password" : "Email code"}
            </button>
          ))}
        </div>
      )}

      {error && <FormAlert>{error}</FormAlert>}

      {mode === "password" ? (
        <form onSubmit={withPassword} noValidate className="space-y-4">
          <Field label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          <div className="-mt-1 text-right text-sm">
            <Link href="/forgot-password" className="text-link hover:underline">
              Forgot password?
            </Link>
          </div>
          <SubmitButton busy={busy}>Sign in</SubmitButton>
        </form>
      ) : !codeSent ? (
        <form onSubmit={sendCode} noValidate className="space-y-4">
          <Field label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="We'll email you a 6-digit code. No password needed." required />
          <SubmitButton busy={busy}>Email me a code</SubmitButton>
        </form>
      ) : (
        <form onSubmit={withCode} noValidate className="space-y-4">
          <FormAlert tone="ok">We sent a code to {email}. It expires in 5 minutes.</FormAlert>
          <Field label="6-digit code" name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required autoFocus />
          <SubmitButton busy={busy}>Sign in</SubmitButton>
          <button type="button" onClick={() => sendCode()} disabled={busy} className="w-full text-sm text-link hover:underline">
            Send a new code
          </button>
        </form>
      )}
    </div>
  );
}
