"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import type { AdminCategory } from "@/lib/api-types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  slug: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), "Lowercase letters, numbers and hyphens"),
  parentId: z.string(),
  description: z.string().trim().max(1000),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isCustomizable: z.boolean(),
  sortOrder: z.coerce.number<string | number>().int().min(0).max(10000),
});
type Values = z.output<typeof schema>;
type InputValues = z.input<typeof schema>;

function toValues(c?: AdminCategory): InputValues {
  return {
    name: c?.name ?? "",
    slug: c?.slug ?? "",
    parentId: c?.parentId ?? "",
    description: c?.description ?? "",
    imageUrl: c?.imageUrl ?? null,
    isActive: c?.isActive ?? true,
    isFeatured: c?.isFeatured ?? false,
    isCustomizable: c?.isCustomizable ?? false,
    sortOrder: c?.sortOrder ?? 0,
  };
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  all,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category?: AdminCategory;
  all: AdminCategory[];
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InputValues, unknown, Values>({ resolver: zodResolver(schema), values: toValues(category) });
  // Only top-level categories can be parents (two-level navigation), never itself.
  const parents = all.filter((c) => !c.parentId && c.id !== category?.id);

  async function submit(v: Values) {
    const body = { ...v, parentId: v.parentId || null, slug: v.slug || undefined, description: v.description || undefined };
    try {
      if (category) await api(`/categories/${category.id}`, { method: "PATCH", body });
      else await api("/categories", { method: "POST", body });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      await qc.invalidateQueries({ queryKey: ["catalog-options"] });
      toast.success(category ? "Category saved" : "Category created");
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
      <DialogContent title={category ? `Edit ${category.name}` : "New category"} className="max-w-xl">
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
          {errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" error={errors.name?.message} {...register("name")} />
            <Input label="URL slug" hint="Leave empty to generate from the name." error={errors.slug?.message} {...register("slug")} />
            <Select label="Parent category" error={errors.parentId?.message} {...register("parentId")}>
              <option value="">None (top level)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Input label="Sort order" type="number" min={0} error={errors.sortOrder?.message} {...register("sortOrder")} />
          </div>
          <Textarea label="Description (optional)" rows={3} error={errors.description?.message} {...register("description")} />
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <ImageUpload label="Category image" folder="/categories" value={field.value} onChange={(img) => field.onChange(img?.url ?? null)} />
            )}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <Checkbox label="Visible in store" {...register("isActive")} />
            <Checkbox label="Featured on home" {...register("isFeatured")} />
            <Checkbox label="Customizable" {...register("isCustomizable")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {category ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesView({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["categories"], queryFn: () => api<AdminCategory[]>("/categories") });
  const [dialog, setDialog] = useState<{ open: boolean; category?: AdminCategory }>({ open: false });

  // Parents first, each followed by its children.
  const ordered = useMemo(() => {
    const all = q.data ?? [];
    const tops = all.filter((c) => !c.parentId || !all.some((p) => p.id === c.parentId));
    return tops.flatMap((t) => [t, ...all.filter((c) => c.parentId === t.id)]);
  }, [q.data]);

  const remove = async (c: AdminCategory) => {
    try {
      await api(`/categories/${c.id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(`"${c.name}" deleted`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const columns: DataColumn<AdminCategory>[] = [
    {
      key: "name",
      header: "Category",
      cell: (c) => (
        <div className="flex items-center gap-2">
          {c.parentId && <CornerDownRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Sub-category" />}
          <div className="min-w-0">
            <p className="truncate font-medium">{c.name}</p>
            <p className="truncate font-mono text-2xs text-muted-foreground">/{c.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "flags",
      header: "Flags",
      hideBelow: "md",
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.isActive ? <Badge variant="success">Visible</Badge> : <Badge variant="outline">Hidden</Badge>}
          {c.isFeatured && <Badge>Featured</Badge>}
          {c.isCustomizable && <Badge variant="secondary">Custom</Badge>}
        </div>
      ),
    },
    { key: "products", header: "Products", cell: (c) => c.productCount },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (c) =>
        canManage ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setDialog({ open: true, category: c })}>
              <Pencil className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              title={`Delete "${c.name}"?`}
              description="Only empty categories can be deleted. Products and sub-categories must be moved first."
              confirmLabel="Delete"
              destructive
              onConfirm={() => remove(c)}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} className="text-destructive hover:bg-destructive/10">
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
            <Plus className="h-4 w-4" /> New category
          </Button>
        </div>
      )}
      <DataTable
        caption="Categories"
        columns={columns}
        rows={ordered}
        rowKey={(c) => c.id}
        loading={q.isPending}
        error={q.isError ? (q.error as Error).message : null}
        empty={{ title: "No categories yet", description: "Create categories to organise your products." }}
      />
      <CategoryDialog
        open={dialog.open}
        category={dialog.category}
        all={q.data ?? []}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </div>
  );
}
