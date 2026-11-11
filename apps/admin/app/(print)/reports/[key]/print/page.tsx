import { ReportTable } from "@/components/report-table";
import { requireStaff } from "@/lib/session";
import { AuthorizationError, getStoreProfile, isReportKey, runReport, ValidationError } from "@ecom/services";
import { brand } from "@ecom/ui/brand";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "../../../orders/[id]/print-button";

export const metadata: Metadata = { title: "Report" };
export const dynamic = "force-dynamic";

/** Printable report: the browser's print dialog saves it as PDF. Needs reports.export. */
export default async function PrintReport({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { actor, user } = await requireStaff("reports.export");
  const { key } = await params;
  if (!isReportKey(key)) notFound();
  const sp = await searchParams;
  let report;
  try {
    report = await runReport({ actor }, key, { from: sp.from, to: sp.to, export: true });
  } catch (err) {
    if (err instanceof AuthorizationError) redirect("/forbidden");
    if (err instanceof ValidationError) notFound();
    throw err;
  }
  const seller = await getStoreProfile();
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-5xl p-8 text-sm print:max-w-none print:p-0">
      <div className="mb-6 flex items-start justify-between gap-6 print:hidden">
        <p className="text-muted-foreground">Use your browser&apos;s print dialog and choose &quot;Save as PDF&quot;.</p>
        <PrintButton />
      </div>
      <header className="mb-5 flex items-end justify-between gap-6 border-b border-black/20 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-black/60">{brand.name}</p>
          <h1 className="text-xl font-bold">{report.title} report</h1>
          {report.range && <p className="text-black/70">{fmt(report.range.from)} – {fmt(report.range.to)} (IST)</p>}
        </div>
        <p className="text-right text-xs text-black/60">
          Generated {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
          <br />by {user.name}
          {seller.gstin && <><br />GSTIN {seller.gstin}</>}
        </p>
      </header>
      <p className="mb-4 text-xs text-black/70">{report.description}</p>
      {report.rows.length === 0 ? <p>Nothing in this date range.</p> : <ReportTable report={report} compact />}
      {report.truncated && <p className="mt-3 text-xs">Only the first 5,000 rows are shown.</p>}
    </div>
  );
}
