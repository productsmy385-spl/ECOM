"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function ModerateButtons({ id, status }: { id: string; status: "pending" | "approved" | "rejected" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);

  async function act(decision: "approved" | "rejected") {
    setBusy(decision);
    try {
      await api(`/reviews/${id}`, { method: "POST", body: { decision } });
      toast.success(decision === "approved" ? "Review published" : "Review rejected");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex shrink-0 gap-2">
      {status !== "approved" && (
        <Button size="sm" variant="success" onClick={() => act("approved")} isLoading={busy === "approved"} disabled={!!busy}>
          <Check className="h-4 w-4" /> Publish
        </Button>
      )}
      {status !== "rejected" && (
        <Button size="sm" variant="outline" onClick={() => act("rejected")} isLoading={busy === "rejected"} disabled={!!busy}>
          <X className="h-4 w-4" /> Reject
        </Button>
      )}
    </div>
  );
}
