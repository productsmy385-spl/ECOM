"use client";

import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status";
import { Badge } from "@/components/ui/badge";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, qs } from "@/lib/api-client";
import { formatDateTime, type Paginated } from "@/lib/api-types";
import type { AdminOrderListItem } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { ORDER_STATUS_LABEL, ORDER_STATUSES } from "@ecom/validation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Palette, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

const columns: DataColumn<AdminOrderListItem>[] = [
  {
    key: "order",
    header: "Order",
    cell: (o) => (
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-mono text-sm font-semibold">
          {o.orderNumber}
          {o.requiresDesignReview && <Palette className="h-3.5 w-3.5 text-primary" aria-label="Has custom designs" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">{formatDateTime(o.placedAt)}</p>
      </div>
    ),
  },
  {
    key: "customer",
    header: "Customer",
    hideBelow: "md",
    cell: (o) => (
      <div className="min-w-0 max-w-[220px]">
        <p className="truncate font-medium">{o.customerName}</p>
        <p className="truncate text-xs text-muted-foreground">{o.customerEmail ?? "Guest"}</p>
      </div>
    ),
  },
  { key: "status", header: "Status", cell: (o) => <OrderStatusBadge status={o.status} /> },
  { key: "payment", header: "Payment", hideBelow: "sm", cell: (o) => <PaymentStatusBadge status={o.paymentStatus} provider={o.paymentProvider} /> },
  { key: "assigned", header: "Assigned", hideBelow: "lg", cell: (o) => (o.assignedStaffName ? <Badge variant="secondary">{o.assignedStaffName}</Badge> : <span className="text-xs text-muted-foreground">—</span>) },
  { key: "total", header: "Total", className: "text-right", cell: (o) => <span className="font-semibold tabular-nums">{formatPaise(o.totalAmount)}</span> },
];

export function OrdersList() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDeferredValue(q);
  const list = useQuery({
    queryKey: ["orders", { q: dq, status, method, page }],
    queryFn: () => api<Paginated<AdminOrderListItem>>(`/orders${qs({ q: dq, status, method, page, pageSize: 20 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_160px]">
        <Input
          label="Search"
          icon={<Search className="h-4 w-4" />}
          placeholder="Order number, name, email or phone"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select
          label="Payment"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All methods</option>
          <option value="razorpay">Online</option>
          <option value="cod">Cash on delivery</option>
        </Select>
      </div>
      <DataTable
        caption="Orders"
        columns={columns}
        rows={list.data?.items}
        rowKey={(o) => o.id}
        loading={list.isPending}
        error={list.isError ? (list.error as Error).message : null}
        onRowClick={(o) => router.push(`/orders/${o.id}`)}
        page={page}
        totalPages={list.data?.totalPages}
        total={list.data?.total}
        onPageChange={setPage}
        empty={{ title: "No orders found", description: "Orders appear here as soon as customers check out." }}
      />
    </div>
  );
}
