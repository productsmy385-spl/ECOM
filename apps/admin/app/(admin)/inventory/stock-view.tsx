"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, qs } from "@/lib/api-client";
import { formatDateTime, type Paginated } from "@/lib/api-types";
import type { listMovements, StockRow } from "@ecom/services";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Search, SlidersHorizontal } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

type Movement = Awaited<ReturnType<typeof listMovements>>[number];
const TYPE: Record<string, string> = { purchase: "Purchase received", adjustment: "Manual adjustment", reservation: "Reserved by order", release: "Reservation released", fulfillment: "Shipped", return: "Returned" };

function Ledger({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const q = useQuery({ queryKey: ["ledger", row.variantId], queryFn: () => api<Movement[]>(`/inventory/${row.variantId}`) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Stock history · ${row.sku}`}>
        <div className="max-h-[60vh] overflow-y-auto">
          {q.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          <ul className="divide-y divide-border text-sm">
            {(q.data ?? []).map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className="font-medium">{TYPE[m.type] ?? m.type}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}{m.actor ? ` · ${m.actor}` : ""}{m.note ? ` · ${m.note}` : ""}</p>
                </div>
                <div className="text-right text-xs tabular-nums">
                  {m.onHandDelta !== 0 && <p className={m.onHandDelta > 0 ? "text-success" : "text-destructive"}>{m.onHandDelta > 0 ? "+" : ""}{m.onHandDelta} on hand</p>}
                  {m.reservedDelta !== 0 && <p className="text-muted-foreground">{m.reservedDelta > 0 ? "+" : ""}{m.reservedDelta} reserved</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Adjust({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [min, setMin] = useState(String(row.minStock));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (delta.trim()) await api(`/variants/${row.variantId}/stock`, { method: "POST", body: { delta: Number(delta), note } });
      if (Number(min) !== row.minStock) await api(`/inventory/${row.variantId}`, { method: "PATCH", body: { minStock: Number(min) } });
      await qc.invalidateQueries({ queryKey: ["stock"] });
      await qc.invalidateQueries({ queryKey: ["ledger", row.variantId] });
      toast.success("Stock updated");
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Adjust ${row.productName}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{row.variantName} · {row.sku} · {row.onHand} on hand, {row.reserved} reserved</p>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Change on hand (e.g. 10 or -2)" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} />
            <Input label="Low-stock alert at" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          {delta.trim() && <Input label="Reason" placeholder="Stock count, damaged, found…" value={note} onChange={(e) => setNote(e.target.value)} />}
          <p className="text-xs text-muted-foreground">To receive stock from a supplier, use Purchases so costs are recorded.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button isLoading={busy} onClick={save} disabled={!!delta.trim() && !note.trim()}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StockView({ canManage }: { canManage: boolean }) {
  const [q, setQ] = useState("");
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  const [ledger, setLedger] = useState<StockRow | null>(null);
  const [adjust, setAdjust] = useState<StockRow | null>(null);
  const dq = useDeferredValue(q);
  const list = useQuery({
    queryKey: ["stock", { q: dq, low, page }],
    queryFn: () => api<Paginated<StockRow>>(`/inventory${qs({ q: dq, low: low ? "true" : "", page, pageSize: 25 })}`),
    placeholderData: keepPreviousData,
  });
  const columns: DataColumn<StockRow>[] = [
    {
      key: "item",
      header: "Item",
      cell: (r) => (
        <div className="min-w-0 max-w-[260px]">
          <p className="truncate font-medium">{r.productName}</p>
          <p className="truncate text-xs text-muted-foreground">{r.variantName} · <span className="font-mono">{r.sku}</span></p>
        </div>
      ),
    },
    { key: "onhand", header: "On hand", hideBelow: "sm", cell: (r) => <span className="tabular-nums">{r.onHand}</span> },
    { key: "reserved", header: "Reserved", hideBelow: "md", cell: (r) => <span className="tabular-nums text-muted-foreground">{r.reserved}</span> },
    { key: "available", header: "Available", cell: (r) => <span className="font-semibold tabular-nums">{r.available}</span> },
    { key: "status", header: "", cell: (r) => (r.available <= 0 ? <Badge variant="danger">Out</Badge> : r.low ? <Badge variant="warning">Low</Badge> : null) },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`History for ${r.sku}`} onClick={(e) => { e.stopPropagation(); setLedger(r); }}><History className="h-4 w-4" /></Button>
          {canManage && <Button variant="ghost" size="icon-sm" aria-label={`Adjust ${r.sku}`} onClick={(e) => { e.stopPropagation(); setAdjust(r); }}><SlidersHorizontal className="h-4 w-4" /></Button>}
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input label="Search" icon={<Search className="h-4 w-4" />} placeholder="Product, variant or SKU" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:w-80" />
        <Checkbox label="Low stock only" checked={low} onChange={(e) => { setLow(e.currentTarget.checked); setPage(1); }} />
      </div>
      <DataTable caption="Stock" columns={columns} rows={list.data?.items} rowKey={(r) => r.variantId} loading={list.isPending} error={list.isError ? (list.error as Error).message : null} page={page} totalPages={list.data?.totalPages} total={list.data?.total} onPageChange={setPage} empty={{ title: "Nothing to show", description: low ? "No items are running low." : "Add products to track their stock." }} />
      {ledger && <Ledger row={ledger} onClose={() => setLedger(null)} />}
      {adjust && <Adjust row={adjust} onClose={() => setAdjust(null)} />}
    </div>
  );
}