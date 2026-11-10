"use client";

import { Badge } from "@/components/ui/badge";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, qs } from "@/lib/api-client";
import { type AdminProductListItem, type CatalogOptions, type Paginated, rupees } from "@/lib/api-types";
import { ikThumb } from "@/lib/imagekit-upload";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ImageOff, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";

const STATUS: Record<AdminProductListItem["status"], { label: string; variant: "success" | "warning" | "outline" }> = {
  published: { label: "Published", variant: "success" },
  draft: { label: "Draft", variant: "warning" },
  archived: { label: "Archived", variant: "outline" },
};

const columns: DataColumn<AdminProductListItem>[] = [
  {
    key: "product",
    header: "Product",
    cell: (p) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
            <img src={ikThumb(p.imageUrl, 88)} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 max-w-[180px] sm:max-w-xs">
          <p className="truncate font-medium">{p.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {p.categoryName}
            {p.brandName ? ` · ${p.brandName}` : ""}
          </p>
        </div>
      </div>
    ),
  },
  { key: "status", header: "Status", cell: (p) => <Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge> },
  { key: "price", header: "From", hideBelow: "md", cell: (p) => <span className="tabular-nums">{rupees(p.minPrice)}</span> },
  {
    key: "stock",
    header: "Available",
    hideBelow: "md",
    cell: (p) => <span className={p.stock <= 0 ? "text-destructive" : "tabular-nums"}>{p.stock <= 0 ? "Out of stock" : p.stock}</span>,
  },
  { key: "variants", header: "Variants", hideBelow: "lg", cell: (p) => p.variantCount },
];

export function ProductsList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const deferredQ = useDeferredValue(q);

  const options = useQuery({ queryKey: ["catalog-options"], queryFn: () => api<CatalogOptions>("/products/options") });
  const list = useQuery({
    queryKey: ["products", { q: deferredQ, status, categoryId, page }],
    queryFn: () => api<Paginated<AdminProductListItem>>(`/products${qs({ q: deferredQ, status, categoryId, page })}`),
    placeholderData: keepPreviousData,
  });
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px_180px]">
        <Input
          aria-label="Search products"
          placeholder="Search by name or SKU"
          icon={<Search className="h-4 w-4" />}
          value={q}
          onChange={(e) => reset(() => setQ(e.target.value))}
        />
        <Select aria-label="Filter by category" value={categoryId} onChange={(e) => reset(() => setCategoryId(e.target.value))}>
          <option value="">All categories</option>
          {options.data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId ? `— ${c.name}` : c.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(e) => reset(() => setStatus(e.target.value))}>
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </Select>
      </div>
      <DataTable
        caption="Products"
        columns={columns}
        rows={list.data?.items}
        rowKey={(p) => p.id}
        loading={list.isPending}
        error={list.isError ? (list.error as Error).message : null}
        empty={
          q || status || categoryId
            ? { title: "No products match", description: "Try a different search or filter." }
            : { title: "No products yet", description: "Add your first product. It stays a draft until you publish it." }
        }
        onRowClick={(p) => router.push(`/products/${p.id}`)}
        page={list.data?.page}
        totalPages={list.data?.totalPages}
        total={list.data?.total}
        onPageChange={setPage}
      />
    </div>
  );
}
