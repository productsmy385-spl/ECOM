"use client";

import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order-status";
import { Badge } from "@/components/ui/badge";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, qs } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatDateTime, type Paginated } from "@/lib/api-types";
import type { AdminOrderListItem } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { ORDER_STATUS_LABEL, ORDER_STATUSES, type OrderStage } from "@ecom/validation";
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

const STAGE_TABS: { key: OrderStage | ""; label: string; dot: string }[] = [
  { key: "", label: "All", dot: "bg-foreground/40" },
  { key: "awaiting_payment", label: "Awaiting payment", dot: "bg-warning" },
  { key: "processing", label: "Processing", dot: "bg-primary" },
  { key: "shipping", label: "Shipped", dot: "bg-info" },
  { key: "delivered", label: "Delivered", dot: "bg-success" },
  { key: "returns", label: "Returns", dot: "bg-highlight" },
  { key: "cancelled", label: "Cancelled", dot: "bg-destructive" },
];

export function OrdersList({ stages }: { stages?: Record<OrderStage, number> }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [stage, setStage] = useState<OrderStage | "">((params.get("stage") as OrderStage) ?? "");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDeferredValue(q);
  const list = useQuery({
    queryKey: ["orders", { q: dq, status, stage, method, page }],
    queryFn: () => api<Paginated<AdminOrderListItem>>(`/orders${qs({ q: dq, status, stage, method, page, pageSize: 20 })}`),
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
            setStage("");
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
      {stages && (
        <div role="tablist" aria-label="Order stage" className="flex flex-wrap gap-2">
          {STAGE_TABS.map((t) => {
            const n = t.key ? stages[t.key] : Object.values(stages).reduce((a, b) => a + b, 0);
            const on = stage === t.key && !status;
            return (
              <button
                key={t.key || "all"}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setStage(t.key);
                  setStatus("");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  on ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-primary-foreground" : t.dot)} aria-hidden="true" />
                {t.label}
                <span className={cn("rounded-full px-1.5 text-2xs font-semibold tabular-nums", on ? "bg-white/20" : "bg-muted")}>{n}</span>
              </button>
            );
          })}
        </div>
      )}
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
