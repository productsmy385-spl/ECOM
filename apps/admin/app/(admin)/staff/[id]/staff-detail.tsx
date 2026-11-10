"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api-client";
import { formatDateTime, type StaffDetail } from "@/lib/api-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailCheck, Power, Send, UserX } from "lucide-react";
import { toast } from "sonner";
import { StaffForm } from "../staff-form";

interface Props {
  id: string;
  me: { id: string; permissions: string[]; isSuperAdmin: boolean };
  canManage: boolean;
}

export function StaffDetailView({ id, me, canManage }: Props) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["staff", id], queryFn: () => api<StaffDetail>(`/staff/${id}`), retry: false });

  if (q.isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (q.isError) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <EmptyState
        icon={<UserX className="h-8 w-8" />}
        title={notFound ? "Staff member not found" : "Couldn't load this staff member"}
        description={notFound ? "They may have been removed, or the link is wrong." : (q.error as Error).message}
      />
    );
  }

  const s = q.data;
  const isSelf = s.id === me.id;
  // Mirrors the server rule (assertCanManageTarget); the server is authoritative.
  const outranked =
    !me.isSuperAdmin &&
    (s.roles.some((r) => r.key === "super_admin") || s.permissions.some((p) => !me.permissions.includes(p)));
  const editable = canManage && (isSelf || !outranked);

  const refresh = async (data?: StaffDetail) => {
    if (data) qc.setQueryData(["staff", id], data);
    await qc.invalidateQueries({ queryKey: ["staff"] });
    await qc.invalidateQueries({ queryKey: ["roles"] });
  };

  const setActive = async (active: boolean) => {
    try {
      const data = await api<StaffDetail>(`/staff/${id}/status`, { method: "POST", body: { active } });
      await refresh(data);
      toast.success(active ? `${s.name} can sign in again` : `${s.name} was deactivated and signed out everywhere`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const resendInvite = async () => {
    try {
      const res = await api<{ sent: boolean; error?: string }>(`/staff/${id}/invite`, { method: "POST" });
      if (res.sent) toast.success(`Invitation sent to ${s.email}`);
      else toast.error(res.error ?? "Could not send the invitation.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.name}
        description={s.email}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {s.status === "active" ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Deactivated</Badge>}
            {!s.hasPassword && <Badge variant="warning">Invitation pending</Badge>}
          </div>
        }
      />

      {outranked && !isSelf && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          This person has access you don&apos;t have, so their account is read-only for you.
        </p>
      )}

      <StaffForm
        key={s.id + s.roles.map((r) => r.id).join()}
        mode="edit"
        readOnly={!editable}
        isSelf={isSelf}
        myPermissions={me.permissions}
        isSuperAdmin={me.isSuperAdmin}
        defaultValues={{
          name: s.name,
          email: s.email,
          phone: s.phone?.replace(/^\+91/, "") ?? "",
          designation: s.designation ?? "",
          employeeCode: s.employeeCode ?? "",
          roleIds: s.roles.map((r) => r.id),
        }}
        onSubmit={async (values) => {
          // Email is immutable; send only the editable fields.
          const body = {
            name: values.name,
            phone: values.phone,
            designation: values.designation,
            employeeCode: values.employeeCode,
            roleIds: values.roleIds,
          };
          const data = await api<StaffDetail>(`/staff/${id}`, { method: "PATCH", body });
          await refresh(data);
          toast.success("Changes saved");
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Account</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Added</dt>
            <dd>{formatDateTime(s.createdAt)}</dd>
            <dt className="text-muted-foreground">Last sign-in</dt>
            <dd>{formatDateTime(s.lastLoginAt)}</dd>
            <dt className="text-muted-foreground">Password</dt>
            <dd>{s.hasPassword ? "Set" : "Not set yet (invitation pending)"}</dd>
          </dl>
          {editable && !isSelf && s.status === "active" && (
            <ConfirmDialog
              title={s.hasPassword ? "Send a password reset link?" : "Resend the invitation?"}
              description={`A single-use link valid for 24 hours will be emailed to ${s.email}.`}
              confirmLabel="Send link"
              onConfirm={resendInvite}
              trigger={
                <Button variant="outline" size="sm" className="mt-4">
                  {s.hasPassword ? <MailCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {s.hasPassword ? "Send password reset" : "Resend invitation"}
                </Button>
              }
            />
          )}
        </Card>

        {editable && !isSelf && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold">{s.status === "active" ? "Deactivate access" : "Restore access"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.status === "active"
                ? "They're signed out of every device immediately and can't sign in. Their history is kept."
                : "They'll be able to sign in again with their existing password."}
            </p>
            <ConfirmDialog
              title={s.status === "active" ? `Deactivate ${s.name}?` : `Reactivate ${s.name}?`}
              description={
                s.status === "active"
                  ? "All of their sessions end now. You can reactivate them later."
                  : "Their roles and permissions are restored as they were."
              }
              confirmLabel={s.status === "active" ? "Deactivate" : "Reactivate"}
              destructive={s.status === "active"}
              onConfirm={() => setActive(s.status !== "active")}
              trigger={
                <Button variant={s.status === "active" ? "destructive" : "outline"} size="sm" className="mt-4">
                  <Power className="h-4 w-4" />
                  {s.status === "active" ? "Deactivate" : "Reactivate"}
                </Button>
              }
            />
          </Card>
        )}
      </div>
    </div>
  );
}
