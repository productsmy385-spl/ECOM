"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(128)
      .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Use both letters and numbers"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function submit(v: Values) {
    const { error } = await authClient.resetPassword({ newPassword: v.password, token });
    if (error) {
      setError("root", {
        message:
          error.status === 400
            ? "This link has expired or was already used. Request a new one."
            : (error.message ?? "Could not set your password."),
      });
      return;
    }
    toast.success("Password set. You can sign in now.");
    router.replace("/login");
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      {errors.root && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters, with letters and numbers."
        error={errors.password?.message}
        {...register("password")}
      />
      <Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
      <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
        Set password
      </Button>
    </form>
  );
}
