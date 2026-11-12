"use client";

import { Badge } from "@/components/ui/badge";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, qs } from "@/lib/api-client";
import { formatDateTime, type Paginated } from "@/lib/api-types";
import type { CustomerListItem } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";

const columns: DataColumn<CustomerListItem>[] = [
  {
    key: "name",
    header: "Customer",
    cell: (c) => (
      <div className="min-w-0 max-w-[240px]">
        <p className="truncate font-medium">{c.name}</p>
        <p className="truncate text-xs text-muted-foreground">{c.email}</p>
      </div>
    ),
  },
  { key: "orders", header: "Orders", cell: (c) => c.orderCount },
  { key: "spent", header: "Spent", hideBelow: "sm", cell: (c) => <span className="tabular-nums">{formatPaise(c.totalSpent)}</span> },
  { key: "last", header: "Last order", hideBelow: "lg", cell: (c) => <span className="text-muted-foreground">{formatDateTime(c.lastOrderAt)}</span> },
  { key: "status", header: "Status", cell: (c) => (c.status === "active" ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Suspended</Badge>) },
];

export function CustomersList() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const [q, setQ] = useState(urlParams.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDeferredValue(q);
  const list = useQuery({
    queryKey: ["customers", { q: dq, status, page }],
    queryFn: () => api<Paginated<CustomerListItem>>(`/customers${qs({ q: dq, status, page, pageSize: 20 })}`),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input label="Search" icon={<Search className="h-4 w-4" />} placeholder="Name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>
      <DataTable
        caption="Customers"
        columns={columns}
        rows={list.data?.items}
        rowKey={(c) => c.id}
        loading={list.isPending}
        error={list.isError ? (list.error as Error).message : null}
        onRowClick={(c) => router.push(`/customers/${c.id}`)}
        page={page}
        totalPages={list.data?.totalPages}
        total={list.data?.total}
        onPageChange={setPage}
        empty={{ title: "No customers yet", description: "Customers appear when they create an account." }}
      />
    </div>
  );
}