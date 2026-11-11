"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api, qs } from "@/lib/api-client";
import { formatDateTime, type Paginated } from "@/lib/api-types";
import type { getPurchase, listPurchases, listSuppliers, StockRow } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Plus, Trash2 } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

type Row = Awaited<ReturnType<typeof listPurchases>>[number];
type Detail = Awaited<ReturnType<typeof getPurchase>>;
type Supplier = Awaited<ReturnType<typeof listSuppliers>>[number];
type Line = { variantId: string; label: string; quantity: string; unitCost: string };

const STATUS: Record<string, { label: string; variant: "secondary" | "info" | "success" | "danger" }> = {
  draft: { label: "Draft", variant: "secondary" },
  ordered: { label: "Ordered", variant: "info" },
  received: { label: "Received", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

function ItemPicker({ onPick }: { onPick: (r: StockRow) => void }) {
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const res = useQuery({ queryKey: ["stock-pick", dq], queryFn: () => api<Paginated<StockRow>>(`/inventory${qs({ q: dq, pageSize: 8 })}`), enabled: dq.trim().length >= 2 });
  return (
    <div className="relative">
      <Input label="Add item" placeholder="Search product or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
      {dq.trim().length >= 2 && (res.data?.items.length ?? 0) > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-dropdown">
          {res.data!.items.map((r) => (
            <li key={r.variantId}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { onPick(r); setQ(""); }}>
                {r.productName} · {r.variantName} <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewPurchase({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => api<Supplier[]>("/suppliers") });
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = lines.reduce((a, l) => a + (Number(l.quantity) || 0) * Math.round((Number(l.unitCost) || 0) * 100), 0);
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await api("/purchases", { method: "POST", body: { supplierId, reference: reference || undefined, notes: notes || undefined, items: lines.map((l) => ({ variantId: l.variantId, quantity: Number(l.quantity), unitCost: Math.round(Number(l.unitCost) * 100) })) } });
      await qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Purchase saved as draft");
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError && e.fieldErrors ? Object.values(e.fieldErrors)[0]?.[0] ?? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="New purchase">
        <div className="space-y-4">
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Choose…</option>
              {(suppliers.data ?? []).filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Reference (optional)" placeholder="Supplier invoice no." value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <ItemPicker onPick={(r) => setLines((ls) => (ls.some((l) => l.variantId === r.variantId) ? ls : [...ls, { variantId: r.variantId, label: `${r.productName} · ${r.variantName}`, quantity: "1", unitCost: "" }]))} />
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={l.variantId} className="grid grid-cols-[1fr_80px_110px_auto] items-end gap-2">
                <p className="truncate pb-2 text-sm">{l.label}</p>
                <Input label="Qty" inputMode="numeric" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                <Input label="Unit cost ₹" inputMode="decimal" value={l.unitCost} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, unitCost: e.target.value } : x)))} />
                <Button variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
          <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">Total cost: <span className="font-semibold">{formatPaise(total)}</span></p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button isLoading={busy} onClick={save} disabled={!supplierId || lines.length === 0}>Save draft</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseDetail({ id, canManage, onClose }: { id: string; canManage: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["purchase", id], queryFn: () => api<Detail>(`/purchases/${id}`) });
  async function act(action: "order" | "receive" | "cancel") {
    try {
      const d = await api<Detail>(`/purchases/${id}`, { method: "POST", body: { action } });
      qc.setQueryData(["purchase", id], d);
      await qc.invalidateQueries({ queryKey: ["purchases"] });
      await qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success(action === "receive" ? "Received. Stock added." : action === "order" ? "Marked as ordered" : "Purchase cancelled");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const p = q.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={p ? `${p.reference} · ${p.supplierName}` : "Purchase"}>
        {!p ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm"><Badge variant={STATUS[p.status]!.variant}>{STATUS[p.status]!.label}</Badge><span className="text-muted-foreground">Created {formatDateTime(p.createdAt)}</span></p>
            <ul className="divide-y divide-border text-sm">
              {p.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2"><span>{i.productName} · {i.variantName} <span className="font-mono text-xs text-muted-foreground">{i.sku}</span></span><span className="tabular-nums">{i.quantity} × {formatPaise(i.unitCost)}</span></li>
              ))}
            </ul>
            <p className="text-right text-sm font-semibold">Total {formatPaise(p.totalCost)}</p>
            {canManage && ["draft", "ordered"].includes(p.status) && (
              <div className="flex flex-wrap justify-end gap-2">
                <ConfirmDialog title="Cancel this purchase?" description="Nothing is added to stock." confirmLabel="Cancel purchase" destructive onConfirm={() => act("cancel")} trigger={<Button variant="ghost">Cancel purchase</Button>} />
                {p.status === "draft" && <Button variant="outline" onClick={() => act("order")}>Mark as ordered</Button>}
                <ConfirmDialog title="Receive this purchase?" description="All quantities are added to stock now." confirmLabel="Receive" onConfirm={() => act("receive")} trigger={<Button><PackageCheck className="h-4 w-4" /> Receive stock</Button>} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PurchasesView({ canManage }: { canManage: boolean }) {
  const q = useQuery({ queryKey: ["purchases"], queryFn: () => api<Row[]>("/purchases") });
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const columns: DataColumn<Row>[] = [
    { key: "ref", header: "Purchase", cell: (r) => (<div><p className="font-mono text-sm font-semibold">{r.reference}</p><p className="text-xs text-muted-foreground">{r.supplierName}</p></div>) },
    { key: "status", header: "Status", cell: (r) => <Badge variant={STATUS[r.status]!.variant}>{STATUS[r.status]!.label}</Badge> },
    { key: "items", header: "Units", hideBelow: "sm", cell: (r) => r.itemCount },
    { key: "date", header: "Created", hideBelow: "md", cell: (r) => <span className="text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
    { key: "total", header: "Cost", className: "text-right", cell: (r) => <span className="tabular-nums">{formatPaise(r.totalCost)}</span> },
  ];
  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New purchase</Button></div>}
      <DataTable caption="Purchases" columns={columns} rows={q.data} rowKey={(r) => r.id} loading={q.isPending} error={q.isError ? (q.error as Error).message : null} onRowClick={(r) => setOpen(r.id)} empty={{ title: "No purchases yet", description: "Record stock you buy from suppliers." }} />
      {creating && <NewPurchase onClose={() => setCreating(false)} />}
      {open && <PurchaseDetail id={open} canManage={canManage} onClose={() => setOpen(null)} />}
    </div>
  );
}