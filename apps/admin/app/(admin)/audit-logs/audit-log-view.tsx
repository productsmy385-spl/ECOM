"use client";

import { Badge } from "@/components/ui/badge";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { api, qs } from "@/lib/api-client";
import { type AuditLogRow, formatDateTime, type Paginated } from "@/lib/api-types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

const ACTION_LABEL: Record<string, string> = {
  "staff.create": "Staff added",
  "staff.update": "Staff details changed",
  "staff.update.roles": "Staff roles changed",
  "staff.activate": "Staff reactivated",
  "staff.deactivate": "Staff deactivated",
  "staff.invite.send": "Invitation / reset link sent",
  "role.create": "Role created",
  "role.update": "Role renamed",
  "role.delete": "Role deleted",
  "role.permissions.update": "Role permissions changed",
};
const label = (a: string) => ACTION_LABEL[a] ?? a;
const tone = (a: string): "danger" | "warning" | "secondary" =>
  a.endsWith("delete") || a.endsWith("deactivate") ? "danger" : a.includes("permissions") || a.includes("roles") ? "warning" : "secondary";

function summary(row: AuditLogRow): string {
  const after = row.after as Record<string, unknown> | null;
  if (row.action === "role.permissions.update" && after) {
    const added = (after.added as string[]) ?? [];
    const removed = (after.removed as string[]) ?? [];
    return [added.length && `+${added.length}`, removed.length && `−${removed.length}`].filter(Boolean).join(" ") + " permissions";
  }
  if (row.action === "staff.update.roles" && after) return `Roles: ${((after.roles as string[]) ?? []).join(", ")}`;
  if (row.action === "staff.create" && after) return String(after.email ?? "");
  if (row.action === "staff.deactivate" && after) return `${after.sessionsRevoked ?? 0} session(s) ended`;
  return row.entityType;
}

export function AuditLogView() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditLogRow | null>(null);

  const facets = useQuery({
    queryKey: ["audit-facets"],
    queryFn: () => api<{ actions: string[]; entityTypes: string[] }>("/audit-logs?facets=1"),
  });
  const logs = useQuery({
    queryKey: ["audit", { action, page }],
    queryFn: () => api<Paginated<AuditLogRow>>(`/audit-logs${qs({ action, page, pageSize: 25 })}`),
    placeholderData: keepPreviousData,
  });

  const columns: DataColumn<AuditLogRow>[] = [
    { key: "when", header: "When", cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
    { key: "action", header: "Action", cell: (r) => <Badge variant={tone(r.action)}>{label(r.action)}</Badge> },
    { key: "actor", header: "By", hideBelow: "sm", cell: (r) => r.actor?.name ?? <span className="text-muted-foreground">System</span> },
    { key: "detail", header: "Detail", hideBelow: "md", cell: (r) => <span className="text-muted-foreground">{summary(r)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All actions</option>
          {facets.data?.actions.map((a) => (
            <option key={a} value={a}>
              {label(a)}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        caption="Audit log entries"
        columns={columns}
        rows={logs.data?.items}
        rowKey={(r) => r.id}
        loading={logs.isPending}
        error={logs.isError ? (logs.error as Error).message : null}
        empty={{ title: "No audit entries", description: "Sensitive changes appear here as they happen." }}
        onRowClick={setOpen}
        page={logs.data?.page}
        totalPages={logs.data?.totalPages}
        total={logs.data?.total}
        onPageChange={setPage}
      />

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent title={label(open.action)} description={`${formatDateTime(open.createdAt)} · ${open.actor?.email ?? "system"}`} className="max-w-2xl">
            <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Record</dt>
              <dd className="break-all font-mono text-xs">{open.entityType} {open.entityId ?? ""}</dd>
              <dt className="text-muted-foreground">IP</dt>
              <dd className="font-mono text-xs">{open.ipAddress ?? "—"}</dd>
            </dl>
            <div className="grid gap-3 md:grid-cols-2">
              {(["before", "after"] as const).map((k) => (
                <div key={k}>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
                  <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">{open[k] ? JSON.stringify(open[k], null, 2) : "—"}</pre>
                </div>
              ))}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
