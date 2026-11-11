"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ui/image-upload";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/api-types";
import type { getDelivery } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, CheckCircle2, Navigation, Package, Phone, RotateCcw, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { DeliveryBadge } from "../deliveries-view";

type Detail = Awaited<ReturnType<typeof getDelivery>>;
type Action = "picked_up" | "out_for_delivery" | "delivered" | "failed" | "reattempt";

/** Best-effort location for the delivery log (never blocks the action). */
function here(): Promise<{ latitude?: number; longitude?: number }> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve({});
    const t = setTimeout(() => resolve({}), 3000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); resolve({ latitude: +p.coords.latitude.toFixed(5), longitude: +p.coords.longitude.toFixed(5) }); },
      () => { clearTimeout(t); resolve({}); },
      { timeout: 2500, maximumAge: 60_000 },
    );
  });
}

export function DeliveryDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["delivery", id], queryFn: () => api<Detail>(`/deliveries/${id}`) });
  const captains = useQuery({ queryKey: ["captains"], queryFn: () => api<{ id: string; name: string }[]>("/deliveries/captains"), enabled: !!q.data?.can.assign });
  const [dialog, setDialog] = useState<"delivered" | "failed" | null>(null);
  const [note, setNote] = useState("");
  const [cash, setCash] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const d = q.data;
  const a = d.order.address;

  async function act(action: Action, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setErr(null);
    try {
      const loc = action === "reattempt" ? {} : await here();
      const data = await api<Detail>(`/deliveries/${id}`, { method: "POST", body: { action, ...loc, ...extra } });
      qc.setQueryData(["delivery", id], data);
      await qc.invalidateQueries({ queryKey: ["deliveries"] });
      setDialog(null);
      setNote("");
      toast.success(action === "delivered" ? "Marked delivered" : action === "failed" ? "Attempt recorded" : "Updated");
    } catch (e) {
      setErr(e instanceof ApiError && e.fieldErrors ? Object.values(e.fieldErrors)[0]?.[0] ?? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function assign(captainId: string) {
    try {
      const data = await api<Detail>(`/deliveries/${id}/assign`, { method: "POST", body: { captainId: captainId || null } });
      qc.setQueryData(["delivery", id], data);
      await qc.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success(captainId ? "Captain assigned" : "Unassigned");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const big = "h-14 w-full text-base";
  const next =
    d.status === "assigned" ? { action: "picked_up" as const, label: "I've picked it up", icon: Package } :
    d.status === "picked_up" || d.status === "in_transit" ? { action: "out_for_delivery" as const, label: "Out for delivery", icon: Truck } : null;
  const canFinish = ["picked_up", "in_transit", "out_for_delivery"].includes(d.status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/deliveries" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Deliveries</Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Order</p>
          <h1 className="font-mono text-xl font-bold">{d.order.orderNumber}</h1>
        </div>
        <DeliveryBadge status={d.status} />
      </div>

      <Card className="space-y-3 p-5">
        <p className="text-lg font-semibold">{a.fullName}</p>
        <p className="text-sm text-muted-foreground">
          {a.line1}{a.line2 ? `, ${a.line2}` : ""}{a.landmark ? ` (near ${a.landmark})` : ""}<br />
          {a.city}, {a.state} {a.postalCode}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${a.phone}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border font-medium hover:border-primary"><Phone className="h-4 w-4" /> Call</a>
          <a href={d.mapsUrl} target="_blank" rel="noopener" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border font-medium hover:border-primary"><Navigation className="h-4 w-4" /> Directions</a>
        </div>
        {d.order.codDue > 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2.5 font-semibold text-warning"><Banknote className="h-5 w-5" /> Collect {formatPaise(d.order.codDue)} in cash</p>
        ) : (
          <p className="rounded-lg bg-success/10 px-3 py-2.5 text-sm font-medium text-success">Prepaid: nothing to collect</p>
        )}
        {d.instructions && <p className="rounded-lg bg-accent px-3 py-2 text-sm">📝 {d.instructions}</p>}
        {d.order.customerNote && <p className="text-xs text-muted-foreground">Customer note: “{d.order.customerNote}”</p>}
      </Card>

      {d.can.act && (next || canFinish) && (
        <div className="space-y-2">
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          {next && (
            <Button className={big} isLoading={busy} onClick={() => act(next.action)}>
              <next.icon className="h-5 w-5" /> {next.label}
            </Button>
          )}
          {canFinish && (
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-14 text-base" variant={next ? "outline" : "default"} onClick={() => { setErr(null); setDialog("delivered"); }}><CheckCircle2 className="h-5 w-5" /> Delivered</Button>
              <Button className="h-14 text-base" variant="outline" onClick={() => { setErr(null); setDialog("failed"); }}><XCircle className="h-5 w-5" /> Couldn&apos;t deliver</Button>
            </div>
          )}
        </div>
      )}

      {d.can.assign && (
        <Card className="space-y-3 p-5">
          <Select label="Captain" value={d.captain?.id ?? ""} onChange={(e) => assign(e.target.value)} disabled={d.status === "delivered"}>
            <option value="">Unassigned</option>
            {(captains.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {d.status === "failed" && (
            <Button variant="outline" onClick={() => act("reattempt", { note: "Reattempt" })} isLoading={busy}><RotateCcw className="h-4 w-4" /> Reattempt delivery</Button>
          )}
          {d.failureReason && <p className="text-sm text-destructive">Last attempt failed: {d.failureReason}</p>}
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Items</h2>
        <ul className="mt-2 space-y-1 text-sm">{d.order.items.map((i, k) => <li key={k}>{i.quantity} × {i.name} <span className="text-muted-foreground">({i.variant})</span></li>)}</ul>
        {d.proofUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${d.proofUrl}?tr=w-600`} alt="Proof of delivery" className="mt-4 max-h-64 rounded-lg border border-border" />
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <ol className="mt-3 space-y-2 border-l-2 border-border pl-4 text-sm">
          {d.history.map((h) => (
            <li key={h.id}>
              <span className="font-medium">{h.to.replace(/_/g, " ")}</span>
              <span className="text-xs text-muted-foreground"> · {formatDateTime(h.at)}{h.actor ? ` · ${h.actor}` : ""}{h.note ? ` · ${h.note}` : ""}</span>
            </li>
          ))}
          {d.history.length === 0 && <li className="text-muted-foreground">Waiting for a captain.</li>}
        </ol>
      </Card>

      <Dialog open={dialog === "delivered"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="Confirm delivery">
          <div className="space-y-4">
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            {d.order.codDue > 0 && <Checkbox label={`I collected ${formatPaise(d.order.codDue)} in cash`} checked={cash} onChange={(e) => setCash(e.currentTarget.checked)} />}
            <ImageUpload label="Photo of the delivered parcel (optional)" folder="/delivery-proofs" value={proof} onChange={(img) => setProof(img?.url ?? null)} />
            <Textarea label="Note (optional)" rows={2} placeholder="e.g. Handed to the security guard" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button className="h-12 w-full" isLoading={busy} disabled={d.order.codDue > 0 && !cash} onClick={() => act("delivered", { codCollected: cash, proofUrl: proof ?? undefined, note: note || undefined })}>Mark delivered</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "failed"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title="Couldn't deliver">
          <div className="space-y-4">
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <Textarea label="What happened?" rows={3} placeholder="Customer not reachable, address locked, refused…" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="destructive" className="h-12 w-full" isLoading={busy} disabled={!note.trim()} onClick={() => act("failed", { note })}>Record failed attempt</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}