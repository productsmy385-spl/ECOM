import { apiRoute, searchParams } from "@/lib/api";
import { isReportKey, reportFileName, reportToCsv, reportToXlsx, runReport } from "@ecom/services";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/:key?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv|xlsx
 * JSON needs reports.view (+ the report's module permission); files also need reports.export.
 */
export const GET = apiRoute<{ key: string }>(async ({ req, ctx, params }) => {
  if (!isReportKey(params.key)) throw Object.assign(new Error("Not found."), { status: 404 });
  const q = searchParams(req);
  const format = q.format ?? "json";
  if (!["json", "csv", "xlsx"].includes(format)) throw Object.assign(new Error("format must be json, csv or xlsx."), { status: 400 });
  const report = await runReport(ctx, params.key, { from: q.from, to: q.to, export: format !== "json" });
  if (format === "json") return report;

  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (format === "csv") {
    return new Response(reportToCsv(report), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${reportFileName(report, "csv")}"` },
    });
  }
  return new Response(Buffer.from(reportToXlsx(report)), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportFileName(report, "xlsx")}"`,
    },
  });
});
