"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import type { RoleSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

// Client-side mirror of @ecom/validation's staff schema (the server re-validates).
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^(\+91)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")), "Enter a valid 10-digit Indian mobile number"),
  designation: z.string().trim().max(80),
  employeeCode: z.string().trim().max(32),
  roleIds: z.array(z.string()).min(1, "Select at least one role"),
});
export type StaffFormValues = z.infer<typeof schema>;

interface StaffFormProps {
  mode: "create" | "edit";
  defaultValues: StaffFormValues;
  /** Permissions held by the signed-in user — roles needing more are shown locked. */
  myPermissions: string[];
  isSuperAdmin: boolean;
  /** Editing yourself: roles are read-only (no self-escalation). */
  isSelf?: boolean;
  readOnly?: boolean;
  onSubmit: (values: StaffFormValues) => Promise<void>;
}

export function StaffForm({ mode, defaultValues, myPermissions, isSuperAdmin, isSelf, readOnly, onSubmit }: StaffFormProps) {
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<RoleSummary[]>("/roles") });
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StaffFormValues>({ resolver: zodResolver(schema), defaultValues });

  // useWatch (not watch()) stays compatible with the React Compiler.
  const selected = useWatch({ control, name: "roleIds" });
  const mine = new Set(myPermissions);
  const lockReason = (r: RoleSummary): string | null => {
    if (readOnly) return "Read-only";
    if (isSelf) return "You can't change your own roles";
    if (r.key === "super_admin" && !isSuperAdmin) return "Only a Super Admin can grant this";
    if (!isSuperAdmin && r.permissions.some((p) => !mine.has(p))) return "Includes access you don't have";
    return null;
  };

  async function submit(values: StaffFormValues) {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, msgs] of Object.entries(err.fieldErrors)) {
          if (msgs?.[0]) setError(field as keyof StaffFormValues, { message: msgs[0] });
        }
      }
      setFormError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-semibold">Profile</h2>
        {formError && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" autoComplete="off" disabled={readOnly} error={errors.name?.message} {...register("name")} />
          <Input
            label="Email"
            type="email"
            autoComplete="off"
            // readOnly (not disabled): react-hook-form drops disabled fields from submitted values.
            readOnly={mode === "edit"}
            className={mode === "edit" ? "bg-muted/50 text-muted-foreground" : undefined}
            hint={mode === "edit" ? "Email can't be changed." : "The invitation is sent here."}
            error={errors.email?.message}
            {...register("email")}
          />
          <Input label="Mobile (optional)" inputMode="tel" placeholder="98765 43210" disabled={readOnly} error={errors.phone?.message} {...register("phone")} />
          <Input label="Designation (optional)" disabled={readOnly} error={errors.designation?.message} {...register("designation")} />
          <Input label="Employee code (optional)" disabled={readOnly} error={errors.employeeCode?.message} {...register("employeeCode")} />
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold">Roles</h2>
          <p className="mt-1 text-xs text-muted-foreground">Access is the combination of all selected roles.</p>
        </div>
        {roles.isPending && <p className="text-sm text-muted-foreground">Loading roles…</p>}
        <fieldset className="space-y-2" aria-describedby={errors.roleIds ? "roles-error" : undefined}>
          <legend className="sr-only">Roles</legend>
          {roles.data?.map((r) => {
            const locked = lockReason(r);
            const checked = selected.includes(r.id);
            return (
              <label
                key={r.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 transition-colors",
                  checked && "border-primary/40 bg-primary/5",
                  locked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/40",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={checked}
                  disabled={!!locked}
                  onChange={(e) =>
                    setValue(
                      "roleIds",
                      e.target.checked ? [...selected, r.id] : selected.filter((id) => id !== r.id),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {r.name}
                    {locked && !readOnly && <Lock className="h-3 w-3 text-muted-foreground" aria-label={locked} />}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {locked && !readOnly ? locked : (r.description ?? `${r.permissions.length} permissions`)}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        {errors.roleIds && (
          <p id="roles-error" className="text-xs text-destructive">
            {errors.roleIds.message}
          </p>
        )}
      </Card>

      {!readOnly && (
        <div className="flex justify-end gap-2 lg:col-span-2">
          <Button type="submit" isLoading={isSubmitting} disabled={mode === "edit" && !isDirty}>
            {mode === "create" ? "Create and send invitation" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
