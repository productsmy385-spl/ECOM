"use client";

import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/select";
import { api, qs } from "@/lib/api-client";
import { formatDateTime, type Paginated } from "@/lib/api-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DESIGN_STATUS, DesignStatusBadge } from "./status";

interface Row {
  id: string;
  name: string;
  status: string;
  productName: string;
  customerName: string;
  designerName: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

const columns: DataColumn<Row>[] = [
  {
    key: "design",
    header: "Design",
    cell: (d) => (
      <div className="min-w-0 max-w-[200px] sm:max-w-xs">
        <p className="truncate font-medium">{d.name}</p>
        <p className="truncate text-xs text-muted-foreground">{d.productName}</p>
      </div>
    ),
  },
  { key: "status", header: "Status", cell: (d) => <DesignStatusBadge status={d.status} /> },
  { key: "customer", header: "Customer", hideBelow: "md", cell: (d) => d.customerName },
  { key: "designer", header: "Designer", hideBelow: "lg", cell: (d) => d.designerName ?? <span className="text-muted-foreground">Unassigned</span> },
  { key: "submitted", header: "Submitted", hideBelow: "md", cell: (d) => <span className="text-muted-foreground">{formatDateTime(d.submittedAt)}</span> },
];

export function DesignsList({ canSeeAll }: { canSeeAll: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(!canSeeAll);
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["designs", { status, mine, page }],
    queryFn: () => api<Paginated<Row>>(`/designs${qs({ status, mine: mine ? "1" : undefined, page })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56">
          <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(DESIGN_STATUS)
              .filter(([k]) => k !== "draft")
              .map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
          </Select>
        </div>
        {canSeeAll && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1); }} />
            Assigned to me
          </label>
        )}
      </div>
      <DataTable
        caption="Designs"
        columns={columns}
        rows={q.data?.items}
        rowKey={(d) => d.id}
        loading={q.isPending}
        error={q.isError ? (q.error as Error).message : null}
        empty={{ title: "No designs here", description: canSeeAll ? "Submitted customer designs appear here." : "Designs assigned to you appear here." }}
        onRowClick={(d) => router.push(`/designs/${d.id}`)}
        page={q.data?.page}
        totalPages={q.data?.totalPages}
        total={q.data?.total}
        onPageChange={setPage}
      />
    </div>
  );
}
