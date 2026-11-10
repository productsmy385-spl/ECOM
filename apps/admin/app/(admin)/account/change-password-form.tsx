"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(128)
      .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use both letters and numbers"),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password" });
type Values = z.infer<typeof schema>;

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function submit(v: Values) {
    const { error } = await authClient.changePassword({
      currentPassword: v.currentPassword,
      newPassword: v.newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      setError(error.status === 400 || error.status === 401 ? "currentPassword" : "root", {
        message: error.status === 400 || error.status === 401 ? "Current password is incorrect" : (error.message ?? "Could not change password."),
      });
      return;
    }
    reset();
    toast.success("Password changed. Other devices were signed out.");
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="mt-4 space-y-4">
      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <Input label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register("currentPassword")} />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters, with letters and numbers."
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
      <Button type="submit" isLoading={isSubmitting}>
        Change password
      </Button>
    </form>
  );
}
