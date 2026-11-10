"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import type { PermissionGroup, RoleSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/** Permissions that let the holder change who can do what — flagged in the UI. */
const SENSITIVE = new Set(["roles.manage", "permissions.manage", "staff.manage", "settings.manage"]);

const MODULE_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Products & catalog",
  orders: "Orders",
  customers: "Customers",
  inventory: "Inventory",
  designs: "Designs",
  deliveries: "Deliveries",
  payments: "Payments",
  support: "Support",
  marketing: "Marketing",
  reports: "Reports",
  staff: "Staff & access",
  settings: "Settings",
};

interface Props {
  canEdit: boolean;
  myPermissions: string[];
  isSuperAdmin: boolean;
}

export function PermissionMatrix({ canEdit, myPermissions, isSuperAdmin }: Props) {
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<RoleSummary[]>("/roles") });
  const catalogue = useQuery({ queryKey: ["permissions"], queryFn: () => api<PermissionGroup[]>("/permissions") });
  /** Pending edits: roleId → full next permission set. */
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState(false);
  const mine = useMemo(() => new Set(myPermissions), [myPermissions]);

  const current = (r: RoleSummary) => draft[r.id] ?? new Set(r.permissions);
  const dirtyIds = Object.keys(draft).filter((id) => {
    const r = roles.data?.find((x) => x.id === id);
    if (!r) return false;
    const next = draft[id]!;
    return next.size !== r.permissions.length || r.permissions.some((p) => !next.has(p));
  });

  function toggle(r: RoleSummary, perm: string) {
    setDraft((d) => {
      const next = new Set(d[r.id] ?? r.permissions);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return { ...d, [r.id]: next };
    });
  }

  async function save() {
    setSaving(true);
    const failures: string[] = [];
    for (const id of dirtyIds) {
      const r = roles.data!.find((x) => x.id === id)!;
      try {
        await api(`/roles/${id}/permissions`, { method: "PUT", body: { permissions: [...draft[id]!] } });
      } catch (err) {
        failures.push(`${r.name}: ${(err as Error).message}`);
      }
    }
    await qc.invalidateQueries({ queryKey: ["roles"] });
    setDraft({});
    setSaving(false);
    if (failures.length) toast.error(`Some roles were not saved — ${failures.join(" · ")}`);
    else toast.success(`Saved permissions for ${dirtyIds.length} role${dirtyIds.length === 1 ? "" : "s"}`);
  }

  if (roles.isPending || catalogue.isPending) return <Skeleton className="h-[480px]" />;
  if (roles.isError || catalogue.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {((roles.error ?? catalogue.error) as Error).message}
      </p>
    );
  }

  const cols = roles.data;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-card backdrop-blur">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {dirtyIds.length ? `${dirtyIds.length} role${dirtyIds.length === 1 ? "" : "s"} with unsaved changes` : "No unsaved changes"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!dirtyIds.length || saving} onClick={() => setDraft({})}>
              <RotateCcw className="h-4 w-4" /> Discard
            </Button>
            <Button size="sm" disabled={!dirtyIds.length} isLoading={saving} onClick={save}>
              Save changes
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Role permission matrix</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-20 min-w-[240px] border-b border-r border-border bg-muted px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Permission
                </th>
                {cols.map((r) => (
                  <th
                    key={r.id}
                    scope="col"
                    className={cn(
                      "sticky top-0 z-10 min-w-[104px] border-b border-border bg-muted px-2 py-3 text-center text-xs font-semibold",
                      dirtyIds.includes(r.id) && "text-primary",
                    )}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {r.key === "super_admin" && <Lock className="h-3 w-3" aria-hidden="true" />}
                      {r.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalogue.data.map((group) => (
                <ModuleRows key={group.module} group={group}>
                  {group.permissions.map((p) => (
                    <tr key={p.key} className="hover:bg-muted/30">
                      <th scope="row" className="sticky left-0 z-[5] border-b border-r border-border bg-card px-4 py-2.5 text-left font-normal">
                        <span className="flex items-center gap-1.5 text-sm">
                          {p.description}
                          {SENSITIVE.has(p.key) && (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="Sensitive: controls access for others" />
                          )}
                        </span>
                        <span className="font-mono text-2xs text-muted-foreground">{p.key}</span>
                      </th>
                      {cols.map((r) => {
                        const isSuper = r.key === "super_admin";
                        const checked = isSuper || current(r).has(p.key);
                        // Granting needs the permission yourself; removing is always allowed.
                        const cannotGrant = !checked && !isSuperAdmin && !mine.has(p.key);
                        const disabled = !canEdit || isSuper || cannotGrant || saving;
                        return (
                          <td key={r.id} className="border-b border-border px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                              checked={checked}
                              disabled={disabled}
                              title={isSuper ? "Super Admin always has every permission" : cannotGrant ? "You can't grant a permission you don't have" : undefined}
                              aria-label={`${r.name}: ${p.description}`}
                              onChange={() => toggle(r, p.key)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </ModuleRows>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Sensitive permissions let the holder change access for others. Grant sparingly.
      </p>
    </div>
  );
}

function ModuleRows({ group, children }: { group: PermissionGroup; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <th
          scope="colgroup"
          colSpan={999}
          className="sticky left-0 border-b border-border bg-surface-tint px-4 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-primary"
        >
          {MODULE_LABEL[group.module] ?? group.module}
        </th>
      </tr>
      {children}
    </>
  );
}
