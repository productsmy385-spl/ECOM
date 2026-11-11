"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Msg = { id: string; body: string; isStaff: boolean; author: string; createdAt: string };

export function TicketThread({ id, initial, closed }: { id: string; initial: Msg[]; closed: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/account/support/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) }).catch(() => null);
    const json = (await res?.json().catch(() => ({}))) as { messages?: Msg[]; error?: string };
    setBusy(false);
    if (!res?.ok || !json.messages) return setError(json.error ?? "Couldn't send. Please try again.");
    setMessages(json.messages);
    setText("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.isStaff ? "bg-blush-50 border border-border" : "ml-auto bg-muted"}`}>
            <p className="whitespace-pre-line">{m.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {m.isStaff ? m.author : "You"} · {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </p>
          </li>
        ))}
      </ol>
      {closed ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">This request is closed. Start a new one if you need more help.</p>
      ) : (
        <form onSubmit={send} className="space-y-2">
          <label htmlFor="reply" className="text-sm font-medium">
            Reply
          </label>
          <textarea
            id="reply"
            required
            minLength={2}
            maxLength={4000}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="block w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-pill px-6 py-2.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Send
          </button>
        </form>
      )}
    </div>
  );
}
