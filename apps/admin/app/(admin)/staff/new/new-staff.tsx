"use client";

import { api } from "@/lib/api-client";
import type { StaffDetail } from "@/lib/api-types";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StaffForm } from "../staff-form";

export function NewStaff({ myPermissions, isSuperAdmin }: { myPermissions: string[]; isSuperAdmin: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();

  return (
    <StaffForm
      mode="create"
      myPermissions={myPermissions}
      isSuperAdmin={isSuperAdmin}
      defaultValues={{ name: "", email: "", phone: "", designation: "", employeeCode: "", roleIds: [] }}
      onSubmit={async (values) => {
        const res = await api<{ staff: StaffDetail; invite: { sent: boolean; error?: string } }>("/staff", {
          method: "POST",
          body: values,
        });
        await qc.invalidateQueries({ queryKey: ["staff"] });
        await qc.invalidateQueries({ queryKey: ["roles"] });
        if (res.invite.sent) toast.success(`Invitation sent to ${res.staff.email}`);
        else toast.warning(`${res.staff.name} was added, but ${res.invite.error?.toLowerCase() ?? "the invitation failed."}`);
        router.push(`/staff/${res.staff.id}`);
      }}
    />
  );
}
