import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import type { Metadata } from "next";
import { AuditLogView } from "./audit-log-view";

export const metadata: Metadata = { title: "Audit logs" };

export default async function AuditLogsPage() {
  await requireStaff("audit_logs.view");
  return (
    <div className="space-y-6">
      <PageHeader title="Audit logs" description="A permanent record of sensitive changes: who did what, and when." />
      <AuditLogView />
    </div>
  );
}
