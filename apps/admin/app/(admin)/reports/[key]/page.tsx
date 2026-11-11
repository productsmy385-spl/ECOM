import { PageHeader } from "@/components/layout/page-header";
import { ReportTable } from "@/components/report-table";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fieldClass } from "@/components/ui/input";
import { requireStaff } from "@/lib/session";
import { cn } from "@/lib/utils";
import { can } from "@ecom/rbac";
import { AuthorizationError, isReportKey, resolveRange, runReport, ValidationError } from "@ecom/services";
import { ChevronLeft, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Search = Promise<{ from?: string; to?: string }>;

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  return { title: `${key.charAt(0).toUpperCase()}${key.slice(1)} report` };
}

function istToday() {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}
function daysBefore(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Search }) {
  const { actor } = await requireStaff("reports.view");
  const { key } = await params;
  if (!isReportKey(key)) notFound();
  const sp = await searchParams;

  let report;
  let error: string | null = null;
  try {
    report = await runReport({ actor }, key, { from: sp.from, to: sp.to });
  } catch (err) {
    if (err instanceof AuthorizationError) redirect("/forbidden");
    if (!(err instanceof ValidationError)) throw err;
    error = err.message;
  }
  const range = report?.range ?? resolveRange({});
  const qs = `from=${range.from}&to=${range.to}`;
  const canExport = can(actor, "reports.export");

  const today = istToday();
  const monthStart = `${today.slice(0, 8)}01`;
  const presets = [
    { label: "Last 7 days", from: daysBefore(today, 6), to: today },
    { label: "Last 30 days", from: daysBefore(today, 29), to: today },
    { label: "This month", from: monthStart, to: today },
    { label: "Last 90 days", from: daysBefore(today, 89), to: today },
  ];

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All reports
      </Link>
      <PageHeader title={`${report?.title ?? key} report`} description={report?.description} />

      <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-muted-foreground">
            From
            <input type="date" name="from" defaultValue={range.from} max={today} className={cn(fieldClass, "mt-1 block w-40")} />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            To
            <input type="date" name="to" defaultValue={range.to} max={today} className={cn(fieldClass, "mt-1 block w-40")} />
          </label>
          <button type="submit" className={buttonVariants({ size: "default" })}>
            Show
          </button>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Link
                key={p.label}
                href={`/reports/${key}?from=${p.from}&to=${p.to}`}
                className={cn(buttonVariants({ variant: p.from === range.from && p.to === range.to ? "secondary" : "ghost", size: "sm" }))}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </form>
        {canExport && report && (
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/api/reports/${key}?${qs}&format=csv`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
              <FileDown className="h-4 w-4" /> CSV
            </a>
            <a href={`/admin/api/reports/${key}?${qs}&format=xlsx`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </a>
            <a href={`/admin/reports/${key}/print?${qs}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Printer className="h-4 w-4" /> PDF
            </a>
          </div>
        )}
      </Card>

      {error && <Card className="border-destructive/40 p-4 text-sm text-destructive">{error}</Card>}

      {report && (
        <Card className="overflow-hidden p-0">
          {report.rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nothing in this date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <ReportTable report={report} />
            </div>
          )}
          {report.truncated && <p className="border-t border-border px-5 py-3 text-xs text-warning">Showing the first 5,000 rows. Narrow the dates to see everything.</p>}
        </Card>
      )}
    </div>
  );
}
