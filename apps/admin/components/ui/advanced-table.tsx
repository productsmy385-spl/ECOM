"use client";

import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface AdvancedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  selectable?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  compact?: boolean;
  showPagination?: boolean;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  onRowClick?: (row: T) => void;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function AdvancedTable<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  searchable = true,
  searchPlaceholder = "Search...",
  selectable = false,
  striped = false,
  hoverable = true,
  bordered = false,
  compact = false,
  showPagination = true,
  title,
  description,
  actions,
  onRowClick,
  emptyMessage = "No results found",
  className,
}: AdvancedTableProps<T>) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Filter data
  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(search.toLowerCase())),
    );
  }, [data, search]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      const comparison = aVal! > bVal! ? 1 : -1;
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = showPagination
    ? sortedData.slice((page - 1) * pageSize, page * pageSize)
    : sortedData;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const toggleAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map((_, i) => i)));
    }
  };

  return (
    <div className={cn("rounded-lg border border-border bg-card animate-fade-in", className)}>
      {/* Header */}
      {(title || searchable || actions) && (
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <div className="flex items-center gap-3">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
                />
              </div>
            )}
            {actions}
          </div>
        </div>
      )}

      {/* Selected indicator */}
      {selectable && selectedRows.size > 0 && (
        <div className="flex items-center gap-3 border-t border-border bg-primary/5 px-5 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selectedRows.size} row{selectedRows.size > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={() => setSelectedRows(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table w-full text-sm">
          <thead>
            <tr
              className={cn(
                "border-y border-border bg-muted/50",
                bordered && "divide-x divide-border",
              )}
            >
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <button
                    onClick={toggleAll}
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-md border transition-colors",
                      selectedRows.size === paginatedData.length && paginatedData.length > 0
                        ? "border-primary bg-primary text-white"
                        : "border-input hover:border-primary",
                    )}
                  >
                    {selectedRows.size === paginatedData.length && paginatedData.length > 0 && (
                      <Check className="h-3 w-3" />
                    )}
                  </button>
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "text-left font-semibold text-muted-foreground",
                    compact ? "px-3 py-2" : "px-4 py-3",
                    col.sortable && "cursor-pointer select-none hover:text-foreground",
                    col.headerClassName,
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <span className="text-muted-foreground/50">
                        {sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(bordered && "divide-y divide-border")}>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "transition-colors",
                    !bordered && "border-b border-border last:border-0",
                    hoverable && "hover:bg-muted/50",
                    striped && index % 2 === 1 && "bg-muted/30",
                    onRowClick && "cursor-pointer",
                    selectedRows.has(index) && "bg-primary/5",
                    bordered && "divide-x divide-border",
                  )}
                >
                  {selectable && (
                    <td className="w-12 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleRow(index)}
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-md border transition-colors",
                          selectedRows.has(index)
                            ? "border-primary bg-primary text-white"
                            : "border-input hover:border-primary",
                        )}
                      >
                        {selectedRows.has(index) && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(compact ? "px-3 py-2" : "px-4 py-3.5", col.className)}
                    >
                      {col.cell ? col.cell(row, index) : (row[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border px-5 py-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}</span>{" "}
            to{" "}
            <span className="font-medium text-foreground">
              {Math.min(page * pageSize, sortedData.length)}
            </span>{" "}
            of <span className="font-medium text-foreground">{sortedData.length}</span> results
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                    page === pageNum
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "border border-border hover:bg-muted",
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
