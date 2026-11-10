"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Skeleton } from "./skeleton";

export interface DataColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Hide below this breakpoint to keep tables readable on phones. */
  hideBelow?: "sm" | "md" | "lg";
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  empty?: { title: string; description?: string };
  onRowClick?: (row: T) => void;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  caption: string;
}

const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

/** Server-paginated table using the shared `.data-table` look. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  empty,
  onRowClick,
  page = 1,
  totalPages = 1,
  total,
  onPageChange,
  caption,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="data-table w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-border bg-muted/50 text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-3 text-left", c.hideBelow && hide[c.hideBelow], c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border">
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3.5", c.hideBelow && hide[c.hideBelow])}>
                      <Skeleton className="h-4 w-full max-w-40 rounded-md" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn("border-b border-border", onRowClick && "cursor-pointer hover:bg-muted/40")}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", c.hideBelow && hide[c.hideBelow], c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && error && (
        <p role="alert" className="px-4 py-10 text-center text-sm text-destructive">
          {error}
        </p>
      )}
      {!loading && !error && rows?.length === 0 && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Inbox className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-semibold">{empty?.title ?? "Nothing here yet"}</p>
          {empty?.description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{empty.description}</p>}
        </div>
      )}

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
            {total !== undefined && ` · ${total} total`}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
