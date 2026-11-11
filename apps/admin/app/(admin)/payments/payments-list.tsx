"use client";

import { PaymentStatusBadge } from "@/components/order-status";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { api, qs } from "@/lib/api-client";
import { formatDateTime, type Paginated } from "@/lib/api-types";
import type { listPaymentsAdmin } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";

type Row = Awaited<ReturnType<typeof listPaymentsAdmin>>["items"][number];

const columns: DataColumn<Row>[] = [
  { key: "order", header: "Order", cell: (p) => (<div><p className="font-mono text-sm font-semibold">{p.orderNumber}</p><p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p></div>) },
  { key: "method", header: "Method", hideBelow: "sm", cell: (p) => (p.provider === "cod" ? "Cash on delivery" : `Razorpay${p.method ? ` · ${p.method}` : ""}`) },
  { key: "ref", header: "Reference", hideBelow: "lg", cell: (p) => <span className="font-mono text-xs">{p.razorpayPaymentId ?? "—"}</span> },
  { key: "status", header: "Status", cell: (p) => <PaymentStatusBadge status={p.status} provider={p.provider} /> },
  { key: "amount", header: "Amount", className: "text-right", cell: (p) => (<div className="tabular-nums"><p>{formatPaise(p.amount)}</p>{p.refundedAmount > 0 && <p className="text-xs text-muted-foreground">−{formatPaise(p.refundedAmount)} refunded</p>}</div>) },
];

export function PaymentsList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDeferredValue(q);
  const list = useQuery({ queryKey: ["payments", { q: dq, page }], queryFn: () => api<Paginated<Row>>(`/payments${qs({ q: dq, page, pageSize: 20 })}`), placeholderData: keepPreviousData });
  return (
    <div className="space-y-4">
      <Input label="Search" icon={<Search className="h-4 w-4" />} placeholder="Order number or Razorpay payment id" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:w-96" />
      <DataTable caption="Payments" columns={columns} rows={list.data?.items} rowKey={(p) => p.id} loading={list.isPending} error={list.isError ? (list.error as Error).message : null} onRowClick={(p) => router.push(`/orders/${p.orderId}`)} page={page} totalPages={list.data?.totalPages} total={list.data?.total} onPageChange={setPage} empty={{ title: "No payments yet" }} />
    </div>
  );
}