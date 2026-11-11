"use client";

import { CANCEL_REASONS, RETURN_REASONS } from "@ecom/validation";
import { FileText, LifeBuoy, Loader2, RefreshCcw, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  orderNumber: string;
  canCancel: boolean;
  canReturn: boolean;
  returnBy: string | null;
  signedIn: boolean;
  invoiceHref: string | null;
};

const btn = "inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary disabled:opacity-50";
const field = "mt-1 block w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const json = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string[]> } & Record<string, unknown>;
  if (!res.ok) throw new Error(json.fieldErrors ? Object.values(json.fieldErrors).flat()[0] ?? json.error : json.error ?? "Something went wrong.");
  return json;
}

/** Cancel, return, buy again, invoice and help: the order's self-service actions. */
export function OrderActions({ orderId, orderNumber, canCancel, canReturn, returnBy, signedIn, invoiceHref }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"cancel" | "return" | null>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function open(m: "cancel" | "return") {
    setMode(m);
    setReason("");
    setDetails("");
    setMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await post(`/api/orders/${orderId}/${mode}`, { reason, details });
      setMode(null);
      setMsg({
        ok: true,
        text: mode === "cancel" ? (r.refundDue ? "Order cancelled. Your refund will be issued to the original payment method in 5–7 business days." : "Order cancelled.") : "Return requested. Our team will contact you about pick-up within 1–2 business days.",
      });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function again() {
    setBusy(true);
    setMsg(null);
    try {
      const r = (await post(`/api/orders/${orderId}/buy-again`, {})) as unknown as { added: string[]; skipped: { name: string; reason: string }[] };
      if (r.added.length) {
        router.push("/cart");
        router.refresh();
      } else setMsg({ ok: false, text: r.skipped.map((s) => `${s.name}: ${s.reason}`).join(" · ") || "Nothing could be added." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const reasons = mode === "cancel" ? CANCEL_REASONS : RETURN_REASONS;

  return (
    <section aria-label="Order actions" className="mt-6 rounded-2xl border border-border p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        {invoiceHref && (
          <a href={invoiceHref} target="_blank" rel="noopener" className={btn}>
            <FileText className="h-4 w-4" aria-hidden="true" /> Invoice
          </a>
        )}
        {signedIn && (
          <button type="button" onClick={again} disabled={busy} className={btn}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Buy again
          </button>
        )}
        {signedIn && canCancel && (
          <button type="button" onClick={() => open("cancel")} aria-expanded={mode === "cancel"} className={btn}>
            <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel order
          </button>
        )}
        {signedIn && canReturn && (
          <button type="button" onClick={() => open("return")} aria-expanded={mode === "return"} className={btn}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Return
          </button>
        )}
        {signedIn ? (
          <Link href={`/account/support/new?order=${orderNumber}`} className={btn}>
            <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Get help
          </Link>
        ) : (
          <Link href="/contact" className={btn}>
            <LifeBuoy className="h-4 w-4" aria-hidden="true" /> Contact us
          </Link>
        )}
      </div>
      {signedIn && canReturn && returnBy && !mode && (
        <p className="mt-3 text-xs text-muted-foreground">Return window open until {new Date(returnBy).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.</p>
      )}

      {mode && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-muted/50 p-4">
          <p className="font-display font-semibold">{mode === "cancel" ? "Cancel this order?" : "Request a return"}</p>
          <label className="block text-sm font-medium">
            Reason
            <select required value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
              <option value="" disabled>
                Choose a reason
              </option>
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            {mode === "cancel" ? "Anything else? (optional)" : "What's wrong? Photos help: you can send them via Get help."}
            <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} required={mode === "return"} minLength={mode === "return" ? 10 : undefined} maxLength={1000} className={field} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !reason} className="btn-pill px-6 py-2.5">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode === "cancel" ? "Cancel order" : "Submit return request"}
            </button>
            <button type="button" onClick={() => setMode(null)} className={btn}>
              Keep order
            </button>
          </div>
        </form>
      )}

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
