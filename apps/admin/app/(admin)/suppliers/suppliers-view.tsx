"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import type { listSuppliers } from "@ecom/services";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Supplier = Awaited<ReturnType<typeof listSuppliers>>[number];
const empty = { name: "", contactName: "", email: "", phone: "", gstin: "", address: "", notes: "", isActive: true };

function SupplierDialog({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState(() => (supplier ? { name: supplier.name, contactName: supplier.contactName ?? "", email: supplier.email ?? "", phone: supplier.phone?.replace(/^\+91/, "") ?? "", gstin: supplier.gstin ?? "", address: supplier.address ?? "", notes: supplier.notes ?? "", isActive: supplier.isActive } : empty));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  async function save() {
    setBusy(true);
    setErrors({});
    try {
      await api(supplier ? `/suppliers/${supplier.id}` : "/suppliers", { method: supplier ? "PATCH" : "POST", body: v });
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(supplier ? "Supplier saved" : "Supplier added");
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, m]) => [k, m?.[0] ?? ""])));
      else toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={supplier ? `Edit ${supplier.name}` : "New supplier"}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={v.name} onChange={set("name")} error={errors.name} />
            <Input label="Contact person (optional)" value={v.contactName} onChange={set("contactName")} />
            <Input label="Email (optional)" value={v.email} onChange={set("email")} error={errors.email} />
            <Input label="Mobile (optional)" value={v.phone} onChange={set("phone")} error={errors.phone} />
            <Input label="GSTIN (optional)" value={v.gstin} onChange={set("gstin")} error={errors.gstin} />
          </div>
          <Textarea label="Address (optional)" rows={2} value={v.address} onChange={set("address")} />
          <Textarea label="Notes (optional)" rows={2} value={v.notes} onChange={set("notes")} />
          <Checkbox label="Active" checked={v.isActive} onChange={(e) => setV((s) => ({ ...s, isActive: e.currentTarget.checked }))} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button isLoading={busy} onClick={save}>{supplier ? "Save" : "Add supplier"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SuppliersView({ canManage }: { canManage: boolean }) {
  const q = useQuery({ queryKey: ["suppliers"], queryFn: () => api<Supplier[]>("/suppliers") });
  const [dialog, setDialog] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null });
  const columns: DataColumn<Supplier>[] = [
    { key: "name", header: "Supplier", cell: (s) => (<div className="min-w-0"><p className="truncate font-medium">{s.name}</p><p className="truncate text-xs text-muted-foreground">{[s.contactName, s.phone, s.email].filter(Boolean).join(" · ") || "—"}</p></div>) },
    { key: "gstin", header: "GSTIN", hideBelow: "md", cell: (s) => <span className="font-mono text-xs">{s.gstin ?? "—"}</span> },
    { key: "purchases", header: "Purchases", hideBelow: "sm", cell: (s) => s.purchaseCount },
    { key: "status", header: "", cell: (s) => (s.isActive ? null : <Badge variant="outline">Inactive</Badge>) },
    { key: "edit", header: "", className: "w-14 text-right", cell: (s) => (canManage ? <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`} onClick={() => setDialog({ open: true, supplier: s })}><Pencil className="h-4 w-4" /></Button> : null) },
  ];
  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><Button onClick={() => setDialog({ open: true, supplier: null })}><Plus className="h-4 w-4" /> New supplier</Button></div>}
      <DataTable caption="Suppliers" columns={columns} rows={q.data} rowKey={(s) => s.id} loading={q.isPending} error={q.isError ? (q.error as Error).message : null} empty={{ title: "No suppliers yet", description: "Add the vendors you buy frames and materials from." }} />
      {dialog.open && <SupplierDialog supplier={dialog.supplier} onClose={() => setDialog({ open: false, supplier: null })} />}
    </div>
  );
}