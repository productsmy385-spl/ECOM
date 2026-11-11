"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { formatDateTime, rupees } from "@/lib/api-types";
import { type CanvasConfig, DesignSurface } from "@ecom/ui/design";
import type { CanvasValue, Prescription } from "@ecom/validation";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageSquareWarning, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DesignStatusBadge } from "../status";

interface Detail {
  id: string;
  name: string;
  status: string;
  version: number;
  product: { id: string; name: string; slug: string; categoryName: string };
  variant: { name: string; sku: string } | null;
  options: { key: string; label: string; type: string; config: Record<string, unknown> }[];
  config: { options: Record<string, unknown> };
  pricing: { base: number; customization: number; total: number };
  summary: { key: string; label: string; value: string; priceDelta: number }[];
  missing: Record<string, string>;
  submittedAt: string | null;
  customer: { name: string; email: string | null } | null;
  assignedDesigner: { id: string; name: string } | null;
  versions: { version: number; authorType: string; createdAt: string }[];
  history: { decision: string; comment: string | null; actorName: string | null; actorType: string; createdAt: string }[];
  notes: { id: string; body: string; authorName: string | null; createdAt: string }[];
}

const DECISION: Record<string, string> = { approved: "Approved", changes_requested: "Changes requested", rejected: "Rejected" };

export function DesignReview({ initial: d, can }: { initial: Detail; can: { assign: boolean; approve: boolean; note: boolean } }) {
  const router = useRouter();
  const open = ["submitted", "in_review"].includes(d.status);
  const canvasOption = d.options.find((o) => o.type === "canvas");
  const canvasValue = canvasOption ? (d.config.options[canvasOption.key] as CanvasValue | undefined) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={d.name}
        description={`${d.product.name}${d.variant ? ` · ${d.variant.name}` : ""} · version ${d.version}`}
        actions={<DesignStatusBadge status={d.status} />}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          {canvasOption && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">{canvasOption.label}</h2>
              <div className="mt-3 overflow-hidden rounded-lg border border-border">
                <DesignSurface config={canvasOption.config as CanvasConfig} value={canvasValue ?? { layers: [] }} showPrintArea title={`${d.name}: design`} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Rendered from the saved design data, exactly as the customer made it. The dashed box is the print area.</p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Customer&apos;s choices</h2>
            <dl className="mt-3 divide-y divide-border text-sm">
              {d.summary.map((s) => (
                <div key={s.key} className="grid grid-cols-[40%_1fr_auto] gap-3 py-2.5">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="break-words">{s.value}</dd>
                  <dd className="tabular-nums text-muted-foreground">{s.priceDelta ? `+${rupees(s.priceDelta)}` : ""}</dd>
                </div>
              ))}
              {d.summary.length === 0 && <p className="py-2 text-muted-foreground">No options chosen.</p>}
            </dl>
            <OptionExtras d={d} />
            <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Price ({rupees(d.pricing.base)} + {rupees(d.pricing.customization)} customisation)</span>
              <span className="font-semibold tabular-nums">{rupees(d.pricing.total)}</span>
            </div>
            {Object.keys(d.missing).length > 0 && (
              <p className="mt-3 text-sm text-warning">Incomplete: {Object.values(d.missing).join(", ")}</p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold">History</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {d.history.map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5">{h.decision === "approved" ? <Check className="h-4 w-4 text-success" /> : h.decision === "rejected" ? <X className="h-4 w-4 text-destructive" /> : <MessageSquareWarning className="h-4 w-4 text-warning" />}</span>
                  <div>
                    <p>
                      <span className="font-medium">{DECISION[h.decision] ?? h.decision}</span>
                      <span className="text-muted-foreground"> by {h.actorType === "customer" ? "customer" : (h.actorName ?? "staff")} · {formatDateTime(h.createdAt)}</span>
                    </p>
                    {h.comment && <p className="text-muted-foreground">“{h.comment}”</p>}
                  </div>
                </li>
              ))}
              <li className="text-muted-foreground">
                Submitted {formatDateTime(d.submittedAt)} · {d.versions.length} version{d.versions.length === 1 ? "" : "s"} saved
              </li>
            </ul>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="p-5 text-sm">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2">{d.customer?.name ?? "Guest (not signed in)"}</p>
            {d.customer?.email && <p className="text-muted-foreground">{d.customer.email}</p>}
          </Card>

          {can.assign && open && <AssignCard id={d.id} current={d.assignedDesigner} onDone={() => router.refresh()} />}
          {!can.assign && (
            <Card className="p-5 text-sm">
              <h2 className="font-semibold">Designer</h2>
              <p className="mt-2">{d.assignedDesigner?.name ?? "Unassigned"}</p>
            </Card>
          )}

          {can.approve && open && <ReviewCard id={d.id} onDone={() => router.refresh()} />}

          <NotesCard id={d.id} notes={d.notes} canAdd={can.note} onDone={() => router.refresh()} />
        </div>
      </div>
    </div>
  );
}

function OptionExtras({ d }: { d: Detail }) {
  const images = d.options.filter((o) => o.type === "image" && typeof d.config.options[o.key] === "string");
  const rx = d.options.find((o) => o.type === "prescription" && d.config.options[o.key]);
  if (!images.length && !rx) return null;
  const p = rx ? (d.config.options[rx.key] as Prescription) : null;
  return (
    <div className="mt-4 space-y-4">
      {images.map((o) => (
        <div key={o.key}>
          <p className="text-xs font-medium text-muted-foreground">{o.label}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- customer upload preview (ImageKit) */}
          <img src={String(d.config.options[o.key])} alt={o.label} className="mt-1 max-h-48 rounded-lg border border-border" />
          <a href={String(d.config.options[o.key])} target="_blank" rel="noopener" className="text-xs text-link hover:underline">
            Open original
          </a>
        </div>
      ))}
      {p && (
        <div className="overflow-x-auto">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{rx!.label}</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left">Eye</th><th>SPH</th><th>CYL</th><th>AXIS</th></tr>
            </thead>
            <tbody className="text-center tabular-nums">
              <tr><td className="text-left">Right (OD)</td><td>{p.right.sph}</td><td>{p.right.cyl}</td><td>{p.right.axis}</td></tr>
              <tr><td className="text-left">Left (OS)</td><td>{p.left.sph}</td><td>{p.left.cyl}</td><td>{p.left.axis}</td></tr>
            </tbody>
          </table>
          <p className="mt-1 text-sm">PD {p.pd}{p.add ? ` · ADD ${p.add}` : ""}{p.notes ? ` · ${p.notes}` : ""}</p>
        </div>
      )}
    </div>
  );
}

function AssignCard({ id, current, onDone }: { id: string; current: { id: string; name: string } | null; onDone: () => void }) {
  const designers = useQuery({ queryKey: ["designers"], queryFn: () => api<{ id: string; name: string }[]>("/designers") });
  const [value, setValue] = useState(current?.id ?? "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(`/designs/${id}/assign`, { method: "POST", body: { designerId: value || null } });
      toast.success(value ? "Designer assigned" : "Designer removed");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-3 p-5">
      <h2 className="text-sm font-semibold">Designer</h2>
      <Select aria-label="Designer" value={value} onChange={(e) => setValue(e.target.value)}>
        <option value="">Unassigned</option>
        {designers.data?.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </Select>
      <Button size="sm" variant="outline" isLoading={busy} disabled={value === (current?.id ?? "")} onClick={save}>
        {current ? "Change designer" : "Assign"}
      </Button>
    </Card>
  );
}

function ReviewCard({ id, onDone }: { id: string; onDone: () => void }) {
  const [comment, setComment] = useState("");
  async function decide(decision: "approved" | "changes_requested" | "rejected") {
    try {
      await api(`/designs/${id}/review`, { method: "POST", body: { decision, comment: comment.trim() || undefined } });
      toast.success(decision === "approved" ? "Design approved" : decision === "rejected" ? "Design rejected" : "Changes requested. The customer can now edit.");
      setComment("");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  const needsReason = comment.trim().length < 5;
  return (
    <Card className="space-y-3 p-5">
      <h2 className="text-sm font-semibold">Review</h2>
      <Textarea label="Message to the customer" hint="Required when requesting changes or rejecting." rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          title="Approve this design?"
          description="It becomes final and ready for production. The customer can no longer edit it."
          confirmLabel="Approve"
          onConfirm={() => decide("approved")}
          trigger={<Button size="sm" variant="success"><Check className="h-4 w-4" /> Approve</Button>}
        />
        <Button size="sm" variant="outline" disabled={needsReason} title={needsReason ? "Write a message first" : undefined} onClick={() => decide("changes_requested")}>
          Request changes
        </Button>
        <ConfirmDialog
          title="Reject this design?"
          description="The customer will see your message. They can start a new design."
          confirmLabel="Reject"
          destructive
          onConfirm={() => decide("rejected")}
          trigger={<Button size="sm" variant="ghost" className="text-destructive" disabled={needsReason}>Reject</Button>}
        />
      </div>
    </Card>
  );
}

function NotesCard({ id, notes, canAdd, onDone }: { id: string; notes: Detail["notes"]; canAdd: boolean; onDone: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try {
      await api(`/designs/${id}/notes`, { method: "POST", body: { body } });
      setBody("");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold">Internal notes</h2>
        <p className="text-xs text-muted-foreground">Staff only. Never shown to the customer.</p>
      </div>
      {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
      <ul className="space-y-3 text-sm">
        {notes.map((n) => (
          <li key={n.id}>
            <p className="whitespace-pre-line">{n.body}</p>
            <p className="text-xs text-muted-foreground">{n.authorName ?? "Staff"} · {formatDateTime(n.createdAt)}</p>
          </li>
        ))}
      </ul>
      {canAdd && (
        <div className="space-y-2">
          <Textarea aria-label="New note" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note for the team" />
          <Button size="sm" variant="outline" isLoading={busy} disabled={!body.trim()} onClick={add}>Add note</Button>
        </div>
      )}
    </Card>
  );
}
