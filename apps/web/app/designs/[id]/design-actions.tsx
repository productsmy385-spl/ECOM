"use client";

import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DesignActions({ id, productId, canEdit, status }: { id: string; productId: string; canEdit: boolean; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(kind: "duplicate" | "delete") {
    if (kind === "delete" && !window.confirm("Delete this design? This can't be undone.")) return;
    setBusy(kind);
    setError(null);
    const res = await fetch(kind === "duplicate" ? `/api/designs/${id}/duplicate` : `/api/designs/${id}`, { method: kind === "duplicate" ? "POST" : "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    if (kind === "duplicate") router.push(`/customize/${productId}?design=${body.id}`);
    else router.push("/designs");
  }

  const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Link href={`/customize/${productId}?design=${id}`} className={`${btn} bg-primary text-primary-foreground hover:bg-primary-hover`}>
            <Pencil className="h-4 w-4" /> {status === "changes_requested" ? "Make changes" : "Continue editing"}
          </Link>
        )}
        <button type="button" onClick={() => call("duplicate")} disabled={!!busy} className={`${btn} border border-input bg-white hover:border-primary`}>
          {busy === "duplicate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Duplicate
        </button>
        {canEdit && (
          <button type="button" onClick={() => call("delete")} disabled={!!busy} className={`${btn} text-destructive hover:bg-destructive/5`}>
            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
