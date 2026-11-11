"use client";

import { PageHeader } from "@/components/layout/page-header";
import { OrderStatusBadge } from "@/components/order-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/api-types";
import type { getCustomerAdmin } from "@ecom/services";
import { formatPaise } from "@ecom/ui/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Power } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type Detail = Awaited<ReturnType<typeof getCustomerAdmin>>;

export function CustomerDetail({ id, canUpdate, canOrders }: { id: string; canUpdate: boolean; canOrders: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customer", id], queryFn: () => api<Detail>(`/customers/${id}`) });
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (q.isError) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const c = q.data;
  const active = c.status === "active";

  async function toggle() {
    try {
      await api(`/customers/${id}/status`, { method: "POST", body: { active: !active } });
      await qc.invalidateQueries({ queryKey: ["customer", id] });
      await qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(active ? "Customer suspended and signed out" : "Customer reactivated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> All customers
      </Link>
      <PageHeader
        title={c.name}
        description={c.email}
        actions={
          <div className="flex items-center gap-2">
            {active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Suspended</Badge>}
            {canUpdate && (
              <ConfirmDialog
                title={active ? `Suspend ${c.name}?` : `Reactivate ${c.name}?`}
                description={active ? "They're signed out now and can't sign in or check out until reactivated. Their orders are kept." : "They can sign in and shop again."}
                confirmLabel={active ? "Suspend" : "Reactivate"}
                destructive={active}
                onConfirm={toggle}
                trigger={
                  <Button variant={active ? "destructive" : "outline"} size="sm">
                    <Power className="h-4 w-4" /> {active ? "Suspend" : "Reactivate"}
                  </Button>
                }
              />
            )}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-xs text-muted-foreground">Orders</p><p className="mt-1 text-2xl font-semibold">{c.orderCount}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground">Total spent</p><p className="mt-1 text-2xl font-semibold">{formatPaise(c.totalSpent)}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground">Designs</p><p className="mt-1 text-2xl font-semibold">{c.designCount}</p></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden p-0">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Orders</h2>
          <ul className="divide-y divide-border">
            {c.orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  {canOrders ? <Link href={`/orders/${o.id}`} className="font-mono font-semibold text-link hover:underline">{o.orderNumber}</Link> : <span className="font-mono font-semibold">{o.orderNumber}</span>}
                  <p className="text-xs text-muted-foreground">{formatDateTime(o.placedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={o.status} />
                  <span className="tabular-nums">{formatPaise(o.total)}</span>
                </div>
              </li>
            ))}
            {c.orders.length === 0 && <li className="px-5 py-6 text-sm text-muted-foreground">No orders yet.</li>}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <h2 className="font-semibold">Account</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-muted-foreground">Phone</dt><dd>{c.phone ?? "—"}</dd>
              <dt className="text-muted-foreground">Joined</dt><dd>{formatDateTime(c.createdAt)}</dd>
              <dt className="text-muted-foreground">Last sign-in</dt><dd>{formatDateTime(c.lastLoginAt)}</dd>
              <dt className="text-muted-foreground">Email</dt><dd>{c.emailVerified ? "Verified" : "Not verified"}</dd>
            </dl>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="font-semibold">Addresses</h2>
            <ul className="mt-3 space-y-3">
              {c.addresses.map((a) => (
                <li key={a.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{a.label ?? a.fullName}</span> {a.isDefault && <Badge variant="secondary">Default</Badge>}
                  <br />
                  {a.line1}, {a.city}, {a.state} {a.postalCode} · {a.phone}
                </li>
              ))}
              {c.addresses.length === 0 && <li className="text-muted-foreground">No saved addresses.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}