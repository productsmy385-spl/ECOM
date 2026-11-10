"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

export function NewsletterForm() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setState("busy");
    setError(null);
    const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (res.ok) setState("done");
    else {
      setState("idle");
      setError(res.status === 429 ? "Too many attempts. Try again in a minute." : "Couldn't subscribe right now. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-5 w-5 text-success" /> You&apos;re subscribed. Watch your inbox for new drops.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-md">
      <div className="flex gap-2">
        <label htmlFor="nl-email" className="sr-only">
          Email address
        </label>
        <input
          id="nl-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!error}
          aria-describedby={error ? "nl-error" : undefined}
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-white px-4 text-sm text-foreground outline-none focus:border-ring"
        />
        <button type="submit" disabled={state === "busy"} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
          {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />} Subscribe
        </button>
      </div>
      {error && (
        <p id="nl-error" role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
