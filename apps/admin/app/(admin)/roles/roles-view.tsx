"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import type { RoleSummary } from "@/lib/api-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(60),
  description: z.string().trim().max(240),
});
type Values = z.infer<typeof schema>;

function RoleDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  role?: RoleSummary;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: role?.name ?? "", description: role?.description ?? "" },
  });

  async function submit(values: Values) {
    try {
      if (role) await api(`/roles/${role.id}`, { method: "PATCH", body: values });
      else await api("/roles", { method: "POST", body: values });
      await qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success(role ? "Role updated" : `Role "${values.name}" created. Now give it permissions.`);
      reset();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? (err.fieldErrors?.name?.[0] ?? err.message) : "Could not save.";
      setError("name", { message: msg });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={role ? `Edit ${role.name}` : "Create role"}
        description={role ? undefined : "Start empty, then choose its permissions in the matrix."}
      >
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
          <Input label="Role name" autoFocus error={errors.name?.message} {...register("name")} />
          <Textarea label="Description (optional)" rows={3} error={errors.description?.message} {...register("description")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {role ? "Save" : "Create role"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RolesView({ canManage, canEditPermissions }: { canManage: boolean; canEditPermissions: boolean }) {
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<RoleSummary[]>("/roles") });
  const [dialog, setDialog] = useState<{ open: boolean; role?: RoleSummary }>({ open: false });

  const remove = async (r: RoleSummary) => {
    try {
      await api(`/roles/${r.id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success(`Role "${r.name}" deleted`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {canEditPermissions && (
          <Link href="/permissions" className={buttonVariants({ variant: "outline" })}>
            <KeyRound className="h-4 w-4" /> Edit permissions
          </Link>
        )}
        {canManage && (
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="h-4 w-4" /> Create role
          </Button>
        )}
      </div>

      {roles.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}
      {roles.isError && (
        <p role="alert" className="text-sm text-destructive">
          {(roles.error as Error).message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {roles.data?.map((r) => {
          const locked = r.key === "super_admin";
          const deleteBlock = r.isSystem
            ? "System roles can't be deleted."
            : r.userCount > 0
              ? `Assigned to ${r.userCount} staff member${r.userCount === 1 ? "" : "s"}.`
              : null;
          return (
            <Card key={r.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {r.name}
                    {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Locked" />}
                  </h2>
                  <p className="mt-0.5 font-mono text-2xs text-muted-foreground">{r.key}</p>
                </div>
                <Badge variant={r.isSystem ? "secondary" : "outline"}>{r.isSystem ? "System" : "Custom"}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{r.description ?? "No description."}</p>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {r.userCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" /> {locked ? "All" : r.permissions.length}
                  </span>
                </div>
                {canManage && !locked && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.name}`} onClick={() => setDialog({ open: true, role: r })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {deleteBlock ? (
                      <Button variant="ghost" size="icon-sm" disabled title={deleteBlock} aria-label={`Can't delete ${r.name}: ${deleteBlock}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <ConfirmDialog
                        title={`Delete "${r.name}"?`}
                        description="This can't be undone. No staff currently have this role."
                        confirmLabel="Delete role"
                        destructive
                        onConfirm={() => remove(r)}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.name}`} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <RoleDialog open={dialog.open} role={dialog.role} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
    </div>
  );
}
