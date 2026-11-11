import { cn } from "@/lib/utils";
import type { ReportColumn, ReportResult, ReportValue } from "@ecom/services";
import { formatNumberIN, formatPaise } from "@ecom/ui/format";

export function formatReportValue(col: ReportColumn, v: ReportValue): string {
  if (v === null || v === "") return "—";
  switch (col.kind) {
    case "money":
      return formatPaise(Number(v));
    case "int":
      return formatNumberIN(Number(v));
    case "hours":
      return `${Number(v).toFixed(1)} h`;
    case "date":
      return new Date(`${v}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    default:
      return String(v);
  }
}

const numeric = (c: ReportColumn) => c.kind === "int" || c.kind === "money" || c.kind === "hours";

/** The report grid, shared by the screen view and the printable (PDF) view. */
export function ReportTable({ report, compact }: { report: ReportResult; compact?: boolean }) {
  const pad = compact ? "px-2 py-1" : "px-4 py-2.5";
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{report.title} report</caption>
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          {report.columns.map((c) => (
            <th key={c.key} scope="col" className={cn(pad, "whitespace-nowrap font-semibold", numeric(c) && "text-right")}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {report.rows.map((row, i) => (
          <tr key={i} className={compact ? "" : "hover:bg-muted/40"}>
            {report.columns.map((c) => (
              <td key={c.key} className={cn(pad, numeric(c) ? "whitespace-nowrap text-right tabular-nums" : "max-w-xs truncate")}>
                {formatReportValue(c, row[c.key] ?? null)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {report.totals && (
        <tfoot>
          <tr className="border-t-2 border-foreground/20 font-semibold">
            {report.columns.map((c) => (
              <td key={c.key} className={cn(pad, numeric(c) && "whitespace-nowrap text-right tabular-nums")}>
                {report.totals![c.key] === null ? "" : c.key === report.columns[0]!.key ? "Total" : formatReportValue(c, report.totals![c.key] ?? null)}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
