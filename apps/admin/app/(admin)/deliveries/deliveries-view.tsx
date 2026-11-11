"use client";

import { Badge } from "@/components/ui/badge";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { api, qs } from "@/lib/api-client";
import { formatDateTime, type Paginated } from "@/lib/api-types";
import type { DeliveryListItem } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Banknote, ChevronRight, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const DELIVERY_STATUS: Record<string, { label: string; variant: "secondary" | "info" | "warning" | "success" | "danger" | "default" }> = {
  unassigned: { label: "Needs captain", variant: "warning" },
  assigned: { label: "Assigned", variant: "secondary" },
  picked_up: { label: "Picked up", variant: "info" },
  in_transit: { label: "In transit", variant: "info" },
  out_for_delivery: { label: "Out for delivery", variant: "default" },
  delivered: { label: "Delivered", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

export function DeliveryBadge({ status }: { status: string }) {
  const s = DELIVERY_STATUS[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const columns: DataColumn<DeliveryListItem>[] = [
  { key: "order", header: "Order", cell: (d) => (<div><p className="font-mono text-sm font-semibold">{d.orderNumber}</p><p className="text-xs text-muted-foreground">{formatDateTime(d.updatedAt)}</p></div>) },
  { key: "to", header: "Deliver to", hideBelow: "md", cell: (d) => (<div className="min-w-0 max-w-[220px]"><p className="truncate">{d.customerName}</p><p className="truncate text-xs text-muted-foreground">{d.city} {d.postalCode}</p></div>) },
  { key: "captain", header: "Captain", hideBelow: "sm", cell: (d) => d.captainName ?? <span className="text-xs text-muted-foreground">—</span> },
  { key: "cod", header: "Collect", hideBelow: "lg", cell: (d) => (d.codDue ? <span className="tabular-nums">{formatPaise(d.codDue)}</span> : <span className="text-xs text-muted-foreground">Prepaid</span>) },
  { key: "status", header: "Status", cell: (d) => <DeliveryBadge status={d.status} /> },
];

export function DeliveriesView({ manager }: { manager: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(manager ? "" : "open");
  const [page, setPage] = useState(1);
  const query = status === "open" ? { open: "true" } : status ? { status } : {};
  const list = useQuery({
    queryKey: ["deliveries", status, page],
    queryFn: () => api<Paginated<DeliveryListItem>>(`/deliveries${qs({ ...query, page, pageSize: 30 })}`),
    placeholderData: keepPreviousData,
    refetchInterval: manager ? false : 60_000,
  });

  const filter = (
    <Select label="Show" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} containerClassName="sm:w-56">
      <option value="open">Active</option>
      <option value="">All</option>
      <option value="unassigned">Needs captain</option>
      <option value="delivered">Delivered</option>
      <option value="failed">Failed</option>
    </Select>
  );

  if (!manager) {
    // Captains: big, thumb-friendly cards.
    return (
      <div className="space-y-4">
        {filter}
        {list.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        <ul className="space-y-3">
          {(list.data?.items ?? []).map((d) => (
            <li key={d.id}>
              <Link href={`/deliveries/${d.id}`} className="block rounded-2xl border border-border bg-card p-4 shadow-card active:bg-muted">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold">{d.orderNumber}</span>
                  <DeliveryBadge status={d.status} />
                </div>
                <p className="mt-2 font-medium">{d.customerName}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {d.city} {d.postalCode}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-4 w-4" /> {d.phone}</span>
                  {d.codDue > 0 ? <span className="flex items-center gap-1 font-semibold text-warning"><Banknote className="h-4 w-4" /> Collect {formatPaise(d.codDue)}</span> : <span className="text-xs text-muted-foreground">Prepaid</span>}
                </div>
                <p className="mt-2 flex items-center justify-end text-xs font-semibold text-primary">Open <ChevronRight className="h-4 w-4" /></p>
              </Link>
            </li>
          ))}
        </ul>
        {list.data && list.data.items.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No deliveries here right now.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filter}
      <DataTable caption="Deliveries" columns={columns} rows={list.data?.items} rowKey={(d) => d.id} loading={list.isPending} error={list.isError ? (list.error as Error).message : null} onRowClick={(d) => router.push(`/deliveries/${d.id}`)} page={page} totalPages={list.data?.totalPages} total={list.data?.total} onPageChange={setPage} empty={{ title: "No deliveries", description: "Orders appear here once they're packed." }} />
    </div>
  );
}