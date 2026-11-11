"use client";

import { TICKET_TOPICS } from "@ecom/validation";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const field = "mt-1 block w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none";

export function NewTicketForm({ orders, initialOrder }: { orders: string[]; initialOrder: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialOrder ? "Order or delivery" : "");
  const [orderNumber, setOrder] = useState(initialOrder);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, orderNumber, subject, message }) }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { id?: string; error?: string; fieldErrors?: Record<string, string[]> };
    if (!res?.ok || !json.id) {
      setBusy(false);
      return setError(json.fieldErrors ? Object.values(json.fieldErrors).flat()[0] ?? json.error ?? "Couldn't send." : json.error ?? "Couldn't send your request. Please try again.");
    }
    router.push(`/account/support/${json.id}`);
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border border-border p-5">
      <label className="block text-sm font-medium">
        Topic
        <select required value={topic} onChange={(e) => setTopic(e.target.value)} className={field}>
          <option value="" disabled>
            Choose a topic
          </option>
          {TICKET_TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {orders.length > 0 && (
        <label className="block text-sm font-medium">
          Order (optional)
          <select value={orderNumber} onChange={(e) => setOrder(e.target.value)} className={field}>
            <option value="">Not about a specific order</option>
            {orders.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium">
        Subject
        <input required minLength={5} maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} className={field} placeholder="e.g. Change the name on my frame" />
      </label>
      <label className="block text-sm font-medium">
        Message
        <textarea required minLength={10} maxLength={4000} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className={field} placeholder="Tell us what happened and how we can help." />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="btn-pill px-6 py-2.5">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Send request
      </button>
      <p className="text-xs text-muted-foreground">We usually reply within one business day. You&apos;ll see our reply here and in your account.</p>
    </form>
  );
}
