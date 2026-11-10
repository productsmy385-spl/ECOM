"use client";

import { Badge } from "@/components/ui/badge";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, qs } from "@/lib/api-client";
import { formatDateTime, type Paginated, type RoleSummary, type StaffListItem } from "@/lib/api-types";
import { getInitials } from "@/lib/utils";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";

const columns: DataColumn<StaffListItem>[] = [
  {
    key: "name",
    header: "Name",
    cell: (s) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-semibold text-primary">
          {getInitials(s.name)}
        </span>
        {/* Width cap lets long emails truncate on phones instead of pushing Status off-screen. */}
        <div className="min-w-0 max-w-[170px] sm:max-w-xs">
          <p className="truncate font-medium">{s.name}</p>
          <p className="truncate text-xs text-muted-foreground">{s.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: "roles",
    header: "Roles",
    hideBelow: "md",
    cell: (s) => (
      <div className="flex flex-wrap gap-1">
        {s.roles.map((r) => (
          <Badge key={r.id} variant={r.key === "super_admin" ? "default" : "secondary"}>
            {r.name}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (s) =>
      s.status === "active" ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Deactivated</Badge>,
  },
  { key: "last", header: "Last sign-in", hideBelow: "lg", cell: (s) => <span className="text-muted-foreground">{formatDateTime(s.lastLoginAt)}</span> },
];

export function StaffList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const deferredQ = useDeferredValue(q);

  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<RoleSummary[]>("/roles") });
  const list = useQuery({
    queryKey: ["staff", { q: deferredQ, role, status, page }],
    queryFn: () => api<Paginated<StaffListItem>>(`/staff${qs({ q: deferredQ, role, status, page, pageSize: 20 })}`),
    placeholderData: keepPreviousData,
  });

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_180px]">
        <Input
          aria-label="Search staff"
          placeholder="Search by name or email"
          icon={<Search className="h-4 w-4" />}
          value={q}
          onChange={(e) => reset(() => setQ(e.target.value))}
        />
        <Select aria-label="Filter by role" value={role} onChange={(e) => reset(() => setRole(e.target.value))}>
          <option value="">All roles</option>
          {roles.data?.map((r) => (
            <option key={r.id} value={r.key}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(e) => reset(() => setStatus(e.target.value))}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Deactivated</option>
        </Select>
      </div>

      <DataTable
        caption="Staff members"
        columns={columns}
        rows={list.data?.items}
        rowKey={(s) => s.id}
        loading={list.isPending}
        error={list.isError ? (list.error as Error).message : null}
        empty={
          q || role || status
            ? { title: "No staff match these filters", description: "Try a different search or clear the filters." }
            : { title: "No staff yet", description: "Add your first team member to give them access." }
        }
        onRowClick={(s) => router.push(`/staff/${s.id}`)}
        page={list.data?.page}
        totalPages={list.data?.totalPages}
        total={list.data?.total}
        onPageChange={setPage}
      />
    </div>
  );
}
