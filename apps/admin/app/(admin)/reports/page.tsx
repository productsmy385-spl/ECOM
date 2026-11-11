import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/session";
import { listReports } from "@ecom/services";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { actor } = await requireStaff("reports.view");
  const reports = listReports(actor);
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Pick a report, choose dates and export it as CSV, Excel or PDF." />
      {reports.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground">None of the reports cover areas your role can see.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((r) => (
            <Link key={r.key} href={`/reports/${r.key}`} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-primary/40">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{r.title}</h2>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{r.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
