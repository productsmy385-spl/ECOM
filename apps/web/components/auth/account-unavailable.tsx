"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { AuthShell } from "./auth-shell";

/** Shown when someone is signed in with Clerk but their store account can't be used. */
export function AccountUnavailable() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell title="Account unavailable" subtitle="This sign-in can't be used to shop right now.">
      <p className="text-sm text-muted-foreground">
        Your email may still need verifying, or the account was closed or paused. Contact support if you think
        this is a mistake.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signOut({ redirectUrl: "/login" });
        }}
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg border border-input text-sm font-semibold hover:bg-muted disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </AuthShell>
  );
}
