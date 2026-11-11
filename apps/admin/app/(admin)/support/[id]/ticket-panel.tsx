"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

type Msg = { id: string; body: string; isStaff: boolean; isInternal: boolean; author: string; createdAt: string };
type Ticket = {
  id: string;
  status: "open" | "in_progress" | "awaiting_customer" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  order: { id: string; orderNumber: string } | null;
  customer: { id: string | null; name: string; email: string | null };
  assignee: { id: string; name: string } | null;
  messages: Msg[];
};

const STATUS = [
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["awaiting_customer", "Waiting on customer"],
  ["resolved", "Resolved"],
  ["closed", "Closed"],
] as const;

export function TicketPanel({ ticket, agents, canManage }: { ticket: Ticket; agents: { id: string; name: string }[]; canManage: boolean }) {
  const [t, setT] = useState(ticket);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setT(await api<Ticket>(`/support/${t.id}`, { method: "POST", body: { message: text, internal } }));
      setText("");
      toast.success(internal ? "Note added" : "Reply sent");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function update(body: Record<string, unknown>) {
    try {
      setT(await api<Ticket>(`/support/${t.id}`, { method: "PATCH", body }));
      toast.success("Ticket updated");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <ol className="space-y-3">
          {t.messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "max-w-[90%] rounded-xl border px-4 py-3 text-sm",
                m.isInternal ? "border-warning/40 bg-warning/5" : m.isStaff ? "ml-auto border-primary/20 bg-primary/5" : "border-border bg-card",
              )}
            >
              {m.isInternal && (
                <p className="mb-1 inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-warning">
                  <Lock className="h-3 w-3" /> Internal note
                </p>
              )}
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.author} · {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </p>
            </li>
          ))}
        </ol>
        {canManage && (
          <Card className="p-4">
            <form onSubmit={reply} className="space-y-3">
              <Textarea label={internal ? "Internal note (only staff see this)" : "Reply to customer"} rows={4} value={text} onChange={(e) => setText(e.target.value)} required minLength={2} maxLength={4000} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Checkbox checked={internal} onChange={(e) => setInternal(e.currentTarget.checked)} label="Internal note" />
                <Button type="submit" isLoading={busy} variant={internal ? "outline" : "default"}>
                  {internal ? "Add note" : "Send reply"}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      <Card className="h-fit space-y-4 p-4">
        <Select label="Status" value={t.status} disabled={!canManage} onChange={(e) => update({ status: e.target.value })}>
          {STATUS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select label="Priority" value={t.priority} disabled={!canManage} onChange={(e) => update({ priority: e.target.value })}>
          {["urgent", "high", "medium", "low"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select label="Assigned to" value={t.assignee?.id ?? ""} disabled={!canManage} onChange={(e) => update({ assignedTo: e.target.value || null })}>
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <div className="space-y-1 border-t border-border pt-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
          <p>{t.customer.name}</p>
          {t.customer.email && <p className="break-all text-muted-foreground">{t.customer.email}</p>}
          {t.customer.id && (
            <Link href={`/customers/${t.customer.id}`} className="text-link hover:underline">
              Customer profile
            </Link>
          )}
          {t.order && (
            <p>
              Order:{" "}
              <Link href={`/orders/${t.order.id}`} className="font-mono text-link hover:underline">
                {t.order.orderNumber}
              </Link>
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
