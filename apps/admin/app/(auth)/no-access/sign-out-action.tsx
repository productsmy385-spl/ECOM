"use client";

import { Button } from "@/components/ui/button";
import { useClerk } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function SignOutAction() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut({ redirectUrl: "/admin/login" });
      }}
    >
      <LogOut className="h-4 w-4" />
      {busy ? "Signing out…" : "Sign out and use another account"}
    </Button>
  );
}
