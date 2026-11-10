"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import type { AdminBrand } from "@/lib/api-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(1000),
  logoUrl: z.string().nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
});
type Values = z.infer<typeof schema>;

function BrandDialog({ open, onOpenChange, brand }: { open: boolean; onOpenChange: (o: boolean) => void; brand?: AdminBrand }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: brand?.name ?? "",
      slug: brand?.slug ?? "",
      description: brand?.description ?? "",
      logoUrl: brand?.logoUrl ?? null,
      isActive: brand?.isActive ?? true,
      isFeatured: brand?.isFeatured ?? false,
    },
  });

  async function submit(v: Values) {
    const body = { ...v, slug: v.slug || undefined, description: v.description || undefined };
    try {
      if (brand) await api(`/brands/${brand.id}`, { method: "PATCH", body });
      else await api("/brands", { method: "POST", body });
      await qc.invalidateQueries({ queryKey: ["brands"] });
      await qc.invalidateQueries({ queryKey: ["catalog-options"] });
      toast.success(brand ? "Brand saved" : "Brand created");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [k, m] of Object.entries(err.fieldErrors)) if (m?.[0]) setError(k as keyof Values, { message: m[0] });
      }
      setError("root", { message: (err as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={brand ? `Edit ${brand.name}` : "New brand"}>
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
          {errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" error={errors.name?.message} {...register("name")} />
            <Input label="URL slug" hint="Leave empty to generate." error={errors.slug?.message} {...register("slug")} />
          </div>
          <Textarea label="Description (optional)" rows={3} {...register("description")} />
          <Controller
            control={control}
            name="logoUrl"
            render={({ field }) => (
              <ImageUpload label="Logo" folder="/brands" value={field.value} onChange={(img) => field.onChange(img?.url ?? null)} />
            )}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Checkbox label="Visible in store" {...register("isActive")} />
            <Checkbox label="Featured on home" {...register("isFeatured")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {brand ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BrandsView({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["brands"], queryFn: () => api<AdminBrand[]>("/brands") });
  const [dialog, setDialog] = useState<{ open: boolean; brand?: AdminBrand }>({ open: false });

  const remove = async (b: AdminBrand) => {
    try {
      await api(`/brands/${b.id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["brands"] });
      toast.success(`"${b.name}" deleted`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const columns: DataColumn<AdminBrand>[] = [
    {
      key: "name",
      header: "Brand",
      cell: (b) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{b.name}</p>
          <p className="truncate font-mono text-2xs text-muted-foreground">/{b.slug}</p>
        </div>
      ),
    },
    {
      key: "flags",
      header: "Flags",
      hideBelow: "sm",
      cell: (b) => (
        <div className="flex flex-wrap gap-1">
          {b.isActive ? <Badge variant="success">Visible</Badge> : <Badge variant="outline">Hidden</Badge>}
          {b.isFeatured && <Badge>Featured</Badge>}
        </div>
      ),
    },
    { key: "products", header: "Products", cell: (b) => b.productCount },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (b) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${b.name}`} onClick={() => setDialog({ open: true, brand: b })}>
              <Pencil className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              title={`Delete "${b.name}"?`}
              description="Only brands without products can be deleted."
              confirmLabel="Delete"
              destructive
              onConfirm={() => remove(b)}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${b.name}`} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setDialog({ open: true })}>
            <Plus className="h-4 w-4" /> New brand
          </Button>
        </div>
      )}
      <DataTable
        caption="Brands"
        columns={columns}
        rows={q.data}
        rowKey={(b) => b.id}
        loading={q.isPending}
        error={q.isError ? (q.error as Error).message : null}
        empty={{ title: "No brands yet", description: "Add the brands you sell so shoppers can filter by them." }}
      />
      <BrandDialog open={dialog.open} brand={dialog.brand} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
    </div>
  );
}
