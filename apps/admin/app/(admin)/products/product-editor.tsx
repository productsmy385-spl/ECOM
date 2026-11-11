"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import type { AdminProduct, AdminVariant, CatalogOptions } from "@/lib/api-types";
import { ACCEPTED_TYPES, ikThumb, uploadToImageKit } from "@/lib/imagekit-upload";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Loader2, PackagePlus, Plus, Trash2, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

// ------------------------------------------------------------------ types

interface VariantValues {
  id?: string;
  sku: string;
  barcode: string;
  name: string;
  color: string;
  colorHex: string;
  size: string;
  material: string;
  price: string; // rupees, as typed
  compareAtPrice: string;
  initialStock: string;
  minStock: string;
  isDefault: boolean;
  isActive: boolean;
  onHand?: number;
  reserved?: number;
}

interface FormValues {
  name: string;
  slug: string;
  categoryId: string;
  brandId: string;
  shortDescription: string;
  description: string;
  isCustomizable: boolean;
  requiresDesignReview: boolean;
  isFeatured: boolean;
  taxRateBps: string;
  hsnCode: string;
  seoTitle: string;
  seoDescription: string;
  variants: VariantValues[];
  attributes: { groupName: string; name: string; value: string; isFilterable: boolean }[];
  images: { url: string; imagekitFileId: string; alt: string; variantSku: string }[];
}

const GST = [
  { bps: 0, label: "0% (exempt)" },
  { bps: 500, label: "5%" },
  { bps: 1200, label: "12%" },
  { bps: 1800, label: "18%" },
  { bps: 2800, label: "28%" },
];

const toRupees = (p: number | null | undefined) => (p === null || p === undefined ? "" : String(p / 100));
const toPaise = (r: string) => (r.trim() === "" ? null : Math.round(Number(r) * 100));

const blankVariant = (isDefault: boolean): VariantValues => ({
  sku: "",
  barcode: "",
  name: "Standard",
  color: "",
  colorHex: "",
  size: "",
  material: "",
  price: "",
  compareAtPrice: "",
  initialStock: "0",
  minStock: "5",
  isDefault,
  isActive: true,
});

function fromProduct(p?: AdminProduct): FormValues {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    categoryId: p?.categoryId ?? "",
    brandId: p?.brandId ?? "",
    shortDescription: p?.shortDescription ?? "",
    description: p?.description ?? "",
    isCustomizable: p?.isCustomizable ?? false,
    requiresDesignReview: p?.requiresDesignReview ?? false,
    isFeatured: p?.isFeatured ?? false,
    taxRateBps: String(p?.taxRateBps ?? 1800),
    hsnCode: p?.hsnCode ?? "",
    seoTitle: p?.seoTitle ?? "",
    seoDescription: p?.seoDescription ?? "",
    variants: p?.variants.map((v: AdminVariant) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode ?? "",
      name: v.name,
      color: v.color ?? "",
      colorHex: v.colorHex ?? "",
      size: v.size ?? "",
      material: v.material ?? "",
      price: toRupees(v.price),
      compareAtPrice: toRupees(v.compareAtPrice),
      initialStock: "0",
      minStock: String(v.minStock),
      isDefault: v.isDefault,
      isActive: v.isActive,
      onHand: v.onHand,
      reserved: v.reserved,
    })) ?? [blankVariant(true)],
    attributes: p?.attributes.map((a) => ({ ...a, groupName: a.groupName ?? "" })) ?? [],
    images: p?.images.map((i) => ({ url: i.url, imagekitFileId: i.imagekitFileId ?? "", alt: i.alt ?? "", variantSku: i.variantSku ?? "" })) ?? [],
  };
}

function toPayload(v: FormValues) {
  const opt = (s: string) => (s.trim() === "" ? undefined : s.trim());
  return {
    name: v.name,
    slug: opt(v.slug),
    categoryId: v.categoryId,
    brandId: v.brandId || null,
    shortDescription: opt(v.shortDescription),
    description: opt(v.description),
    isCustomizable: v.isCustomizable,
    requiresDesignReview: v.isCustomizable && v.requiresDesignReview,
    isFeatured: v.isFeatured,
    taxRateBps: Number(v.taxRateBps),
    hsnCode: opt(v.hsnCode),
    seoTitle: opt(v.seoTitle),
    seoDescription: opt(v.seoDescription),
    variants: v.variants.map((x) => ({
      id: x.id,
      sku: x.sku,
      barcode: opt(x.barcode),
      name: x.name,
      color: opt(x.color),
      colorHex: opt(x.colorHex),
      size: opt(x.size),
      material: opt(x.material),
      price: toPaise(x.price) ?? 0,
      compareAtPrice: toPaise(x.compareAtPrice),
      isDefault: x.isDefault,
      isActive: x.isActive,
      initialStock: x.id ? undefined : Number(x.initialStock || 0),
      minStock: Number(x.minStock || 0),
    })),
    attributes: v.attributes.filter((a) => a.name.trim() && a.value.trim()).map((a) => ({ ...a, groupName: opt(a.groupName) })),
    images: v.images.map((i) => ({ url: i.url, imagekitFileId: opt(i.imagekitFileId), alt: opt(i.alt), variantSku: opt(i.variantSku) })),
  };
}

// --------------------------------------------------------------- component

interface Props {
  product?: AdminProduct;
  can: { update: boolean; create: boolean; publish: boolean; delete: boolean; stock: boolean };
  webUrl: string;
}

export function ProductEditor({ product, can, webUrl }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const options = useQuery({ queryKey: ["catalog-options"], queryFn: () => api<CatalogOptions>("/products/options") });
  const editable = product ? can.update : can.create;
  const [formError, setFormError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<FormValues>({ defaultValues: fromProduct(product) });
  const variants = useFieldArray({ control, name: "variants" });
  const attributes = useFieldArray({ control, name: "attributes" });
  const images = useFieldArray({ control, name: "images" });
  const isCustomizable = useWatch({ control, name: "isCustomizable" });
  const variantSkus = useWatch({ control, name: "variants" }).map((v) => v.sku).filter(Boolean);

  async function save(values: FormValues) {
    setFormError(null);
    try {
      const body = toPayload(values);
      const saved = product
        ? await api<AdminProduct>(`/products/${product.id}`, { method: "PUT", body })
        : await api<AdminProduct>("/products", { method: "POST", body });
      await qc.invalidateQueries({ queryKey: ["products"] });
      qc.setQueryData(["product", saved.id], saved);
      if (product) {
        reset(fromProduct(saved));
        toast.success("Product saved");
      } else {
        toast.success("Product created as a draft");
        router.replace(`/products/${saved.id}`);
      }
    } catch (err) {
      const fe = err instanceof ApiError ? err.fieldErrors : undefined;
      const detail = fe ? Object.entries(fe).map(([k, m]) => `${k}: ${m?.[0]}`).join(" · ") : "";
      setFormError(`${(err as Error).message}${detail ? ` (${detail})` : ""}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function setStatus(status: "published" | "draft") {
    if (!product) return;
    setStatusBusy(true);
    try {
      const p = await api<AdminProduct>(`/products/${product.id}/status`, { method: "POST", body: { status } });
      qc.setQueryData(["product", product.id], { ...product, status: p.status });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["product", product.id] });
      toast.success(status === "published" ? "Published. It's live in the store." : "Unpublished. Hidden from the store.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setStatusBusy(false);
    }
  }

  async function remove() {
    if (!product) return;
    try {
      await api(`/products/${product.id}`, { method: "DELETE" });
      await qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
      router.replace("/products");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const statusBadge = product && (
    <Badge variant={product.status === "published" ? "success" : product.status === "draft" ? "warning" : "outline"}>
      {product.status === "published" ? "Published" : product.status === "draft" ? "Draft" : "Archived"}
    </Badge>
  );

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="space-y-6">
      <PageHeader
        title={product ? product.name : "Add product"}
        description={product ? `/${product.slug}` : "New products start as drafts. Publish when ready."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            {product && (
              <Link href={`/products/${product.id}/customization`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Wand2 className="h-4 w-4" /> Customisation
              </Link>
            )}
            {product?.status === "published" && (
              <a href={`${webUrl}/products/${product.slug}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
                <ExternalLink className="h-4 w-4" /> View in store
              </a>
            )}
            {product && can.publish && product.status !== "published" && (
              <Button type="button" variant="dark" size="sm" isLoading={statusBusy} disabled={isDirty} title={isDirty ? "Save changes first" : undefined} onClick={() => setStatus("published")}>
                Publish
              </Button>
            )}
            {product && can.publish && product.status === "published" && (
              <ConfirmDialog
                title="Unpublish this product?"
                description="It disappears from the store immediately. You can publish it again any time."
                confirmLabel="Unpublish"
                onConfirm={() => setStatus("draft")}
                trigger={
                  <Button type="button" variant="outline" size="sm" isLoading={statusBusy}>
                    Unpublish
                  </Button>
                }
              />
            )}
            {editable && (
              <Button type="submit" size="sm" isLoading={isSubmitting} disabled={!!product && !isDirty}>
                {product ? "Save changes" : "Create draft"}
              </Button>
            )}
          </div>
        }
      />

      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {formError}
        </p>
      )}

      <fieldset disabled={!editable} className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {/* Basics */}
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold">Basics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Product name" error={errors.name?.message} {...register("name", { required: "Name is required" })} />
              <Input label="URL slug" hint="Leave empty to generate from the name." {...register("slug")} />
              <Select label="Category" error={errors.categoryId?.message} {...register("categoryId", { required: "Choose a category" })}>
                <option value="">Choose…</option>
                {options.data?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? `— ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
              <Select label="Brand (optional)" {...register("brandId")}>
                <option value="">No brand</option>
                {options.data?.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <Input label="Short description" hint="One line shown on product cards and search results." {...register("shortDescription")} />
            <Textarea label="Description" rows={6} {...register("description")} />
          </Card>

          {/* Variants */}
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Variants, pricing &amp; stock</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Prices in ₹, GST-inclusive. MRP is optional and shown struck through.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => variants.append(blankVariant(false))}>
                <Plus className="h-4 w-4" /> Add variant
              </Button>
            </div>
            <div className="space-y-3">
              {variants.fields.map((f, i) => (
                <div key={f.id} className={cn("rounded-lg border border-border p-4", !getValues(`variants.${i}.isActive`) && "opacity-60")}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="defaultVariant"
                        className="accent-primary"
                        defaultChecked={f.isDefault}
                        onChange={() => variants.fields.forEach((_, j) => setValue(`variants.${j}.isDefault`, j === i, { shouldDirty: true }))}
                      />
                      Default
                    </label>
                    <div className="flex items-center gap-3">
                      <Checkbox label="Active" {...register(`variants.${i}.isActive`)} />
                      {variants.fields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove variant ${i + 1}`} className="text-destructive" onClick={() => variants.remove(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input label="SKU" {...register(`variants.${i}.sku`, { required: true })} />
                    <Input label="Variant name" {...register(`variants.${i}.name`, { required: true })} />
                    <Input label="Price (₹)" type="number" step="0.01" min="0" inputMode="decimal" {...register(`variants.${i}.price`, { required: true })} />
                    <Input label="MRP (₹)" type="number" step="0.01" min="0" inputMode="decimal" {...register(`variants.${i}.compareAtPrice`)} />
                    <Input label="Colour" {...register(`variants.${i}.color`)} />
                    <div className="space-y-1.5">
                      <label htmlFor={`hex-${i}`} className="block text-sm font-medium">
                        Swatch
                      </label>
                      <div className="flex gap-2">
                        <input
                          id={`hex-${i}`}
                          type="color"
                          className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                          defaultValue={getValues(`variants.${i}.colorHex`) || "#000000"}
                          onChange={(e) => setValue(`variants.${i}.colorHex`, e.target.value.toUpperCase(), { shouldDirty: true })}
                        />
                        <Input aria-label="Swatch hex" placeholder="#CF0F47" {...register(`variants.${i}.colorHex`)} />
                      </div>
                    </div>
                    <Input label="Size" {...register(`variants.${i}.size`)} />
                    <Input label="Material" {...register(`variants.${i}.material`)} />
                    <Input label="Barcode (optional)" {...register(`variants.${i}.barcode`)} />
                    {f.id ? (
                      <StockCell variantId={f.id} sku={f.sku} onHand={f.onHand ?? 0} reserved={f.reserved ?? 0} canAdjust={can.stock} productId={product?.id} />
                    ) : (
                      <Input
                        label="Initial stock"
                        type="number"
                        min="0"
                        disabled={!can.stock}
                        hint={can.stock ? undefined : "Needs inventory permission"}
                        {...register(`variants.${i}.initialStock`)}
                      />
                    )}
                    <Input label="Low-stock alert at" type="number" min="0" {...register(`variants.${i}.minStock`)} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Specs */}
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Specifications</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Shown on the product page. Mark useful ones as filterable.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => attributes.append({ groupName: "", name: "", value: "", isFilterable: false })}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {attributes.fields.length === 0 && <p className="text-sm text-muted-foreground">No specifications yet, e.g. “Frame size: 8 × 10 in”.</p>}
            {attributes.fields.map((f, i) => (
              <div key={f.id} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto_auto]">
                <Input label="Group" placeholder="Dimensions" {...register(`attributes.${i}.groupName`)} />
                <Input label="Name" {...register(`attributes.${i}.name`)} />
                <Input label="Value" {...register(`attributes.${i}.value`)} />
                <div className="pb-2">
                  <Checkbox label="Filter" {...register(`attributes.${i}.isFilterable`)} />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove specification" className="text-destructive" onClick={() => attributes.remove(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Images */}
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Images</h2>
              <span className="text-xs text-muted-foreground">First image is the cover</span>
            </div>
            {images.fields.length === 0 && <p className="text-sm text-muted-foreground">No images yet. The store shows a neutral placeholder.</p>}
            <ul className="space-y-3">
              {images.fields.map((f, i) => (
                <li key={f.id} className="flex gap-3 rounded-lg border border-border p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                  <img src={ikThumb(f.url, 120)} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input aria-label="Alt text" placeholder="Describe the image" {...register(`images.${i}.alt`)} />
                    <Select aria-label="Variant" {...register(`images.${i}.variantSku`)}>
                      <option value="">All variants</option>
                      {variantSkus.map((s) => (
                        <option key={s} value={s.toUpperCase()}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => images.move(i, i - 1)}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === images.fields.length - 1} onClick={() => images.move(i, i + 1)}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove image" className="text-destructive" onClick={() => images.remove(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <ImageAdder onAdd={(img) => images.append({ url: img.url, imagekitFileId: img.fileId, alt: "", variantSku: "" })} />
          </Card>

          {/* Options */}
          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Options</h2>
            <Checkbox label="Featured on home page" {...register("isFeatured")} />
            <Checkbox label="Customers can customise this product" {...register("isCustomizable")} />
            {isCustomizable && <Checkbox label="Designer reviews each customised order" {...register("requiresDesignReview")} />}
          </Card>

          {/* Tax */}
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold">Tax</h2>
            <Select label="GST rate" {...register("taxRateBps")}>
              {GST.map((g) => (
                <option key={g.bps} value={g.bps}>
                  {g.label}
                </option>
              ))}
            </Select>
            <Input label="HSN code (optional)" {...register("hsnCode")} />
          </Card>

          {/* SEO */}
          <Card className="space-y-4 p-5">
            <h2 className="text-sm font-semibold">Search engine listing</h2>
            <Input label="Title" hint="Up to 70 characters." maxLength={70} {...register("seoTitle")} />
            <Textarea label="Description" hint="Up to 170 characters." maxLength={170} rows={3} {...register("seoDescription")} />
          </Card>

          {product && can.delete && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Delete product</h2>
              <p className="mt-1 text-sm text-muted-foreground">Removes it from the store and admin lists. Past orders keep their records.</p>
              <ConfirmDialog
                title={`Delete "${product.name}"?`}
                description="It's removed from the store immediately. This can't be undone from the admin."
                confirmLabel="Delete product"
                destructive
                onConfirm={remove}
                trigger={
                  <Button type="button" variant="destructive" size="sm" className="mt-3">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                }
              />
            </Card>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function ImageAdder({ onAdd }: { onAdd: (img: { url: string; fileId: string }) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, 10)) onAdd(await uploadToImageKit(file, "/products"));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 503 ? "Image uploads aren't configured yet (ImageKit keys missing)." : (err as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" className="w-full" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Upload images
      </Button>
      <input ref={ref} type="file" multiple accept={ACCEPTED_TYPES.join(",")} className="sr-only" aria-label="Upload product images" onChange={(e) => pick(e.target.files)} />
      <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG, WebP or AVIF · up to 5 MB each</p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function StockCell(props: { variantId: string; sku: string; onHand: number; reserved: number; canAdjust: boolean; productId?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local copy: the server response is the source of truth after an adjustment.
  const [stock, setStock] = useState({ onHand: props.onHand, reserved: props.reserved });
  const available = stock.onHand - stock.reserved;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ onHand: number; reserved: number }>(`/variants/${props.variantId}/stock`, {
        method: "POST",
        body: { delta: Number(delta), note },
      });
      setStock({ onHand: res.onHand, reserved: res.reserved });
      toast.success(`Stock updated for ${props.sku}`);
      setOpen(false);
      setDelta("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Stock</p>
      <div className="flex h-9 items-center gap-2">
        <span className={cn("text-sm tabular-nums", available <= 0 && "text-destructive")}>
          {available} available{stock.reserved ? ` (${stock.reserved} reserved)` : ""}
        </span>
        {props.canAdjust && (
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Adjust stock for ${props.sku}`} onClick={() => setOpen(true)}>
            <PackagePlus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Adjust stock · ${props.sku}`} description={`On hand: ${stock.onHand}. Use a negative number to remove stock.`}>
          <div className="space-y-4">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Input label="Change" type="number" placeholder="e.g. 20 or -2" value={delta} onChange={(e) => setDelta(e.target.value)} />
            <Input label="Reason" placeholder="Stock received, damaged, recount…" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" isLoading={busy} disabled={!delta || Number(delta) === 0 || !note.trim()} onClick={submit}>
                Record change
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
