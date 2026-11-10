import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const { user } = await requireStaff();
  return (
    <div className="space-y-6">
      <PageHeader title="My account" description="Your profile and sign-in security." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Profile</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{user.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all">{user.email}</dd>
            <dt className="text-muted-foreground">Roles</dt>
            <dd className="flex flex-wrap gap-1">
              {user.roleNames.map((r) => (
                <Badge key={r} variant="secondary">
                  {r}
                </Badge>
              ))}
            </dd>
            <dt className="text-muted-foreground">Permissions</dt>
            <dd>{user.isSuperAdmin ? "All" : user.permissions.length}</dd>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            To change your name or roles, ask someone with staff management access.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-muted-foreground">You&apos;ll stay signed in here; other devices are signed out.</p>
          <ChangePasswordForm />
        </Card>
      </div>
    </div>
  );
}
