"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError, api } from "@/lib/api-client";
import { formatPaise } from "@ecom/ui/format";
import type { Paginated } from "@ecom/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "fixed" | "free_shipping";
  value: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  usedCount: number;
  isActive: boolean;
  state: "active" | "inactive" | "expired" | "scheduled" | "used_up";
}

const STATE: Record<Coupon["state"], { label: string; variant: "success" | "outline" | "warning" | "danger" | "secondary" }> = {
  active: { label: "Active", variant: "success" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  inactive: { label: "Off", variant: "outline" },
  expired: { label: "Expired", variant: "danger" },
  used_up: { label: "Used up", variant: "warning" },
};

// The form works in rupees and percent; the API stores paise and basis points.
const rupees = z.string().trim().refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 1_000_000), "Enter an amount in rupees");
const schema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, "3–40 letters, numbers, - or _"),
    description: z.string().trim().max(200),
    type: z.enum(["percent", "fixed", "free_shipping"]),
    amount: z.string().trim(),
    minOrder: rupees,
    maxDiscount: rupees,
    startsAt: z.string(),
    endsAt: z.string(),
    usageLimit: z.string().trim().refine((v) => v === "" || /^[1-9]\d{0,6}$/.test(v), "Whole number"),
    perCustomerLimit: z.string().trim().regex(/^[1-9]\d?$/, "1–99"),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "percent" && !(/^\d+(\.\d{1,2})?$/.test(v.amount) && Number(v.amount) > 0 && Number(v.amount) <= 100)) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter a percentage between 0.01 and 100" });
    }
    if (v.type === "fixed" && !(/^\d+(\.\d{1,2})?$/.test(v.amount) && Number(v.amount) > 0)) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the discount in rupees" });
    }
  });
type Values = z.infer<typeof schema>;

const toPaise = (v: string) => (v === "" ? null : Math.round(Number(v) * 100));
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

function CouponDialog({ open, onOpenChange, coupon }: { open: boolean; onOpenChange: (o: boolean) => void; coupon?: Coupon }) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      code: coupon?.code ?? "",
      description: coupon?.description ?? "",
      type: coupon?.type ?? "percent",
      amount: coupon ? (coupon.type === "percent" ? String(coupon.value / 100) : coupon.type === "fixed" ? String(coupon.value / 100) : "") : "",
      minOrder: coupon?.minOrderAmount ? String(coupon.minOrderAmount / 100) : "",
      maxDiscount: coupon?.maxDiscountAmount ? String(coupon.maxDiscountAmount / 100) : "",
      startsAt: local(coupon?.startsAt ?? null),
      endsAt: local(coupon?.endsAt ?? null),
      usageLimit: coupon?.usageLimit ? String(coupon.usageLimit) : "",
      perCustomerLimit: String(coupon?.perCustomerLimit ?? 1),
      isActive: coupon?.isActive ?? true,
    },
  });
  const type = watch("type");

  async function submit(v: Values) {
    const body = {
      code: v.code,
      description: v.description || undefined,
      type: v.type,
      value: v.type === "free_shipping" ? 0 : Math.round(Number(v.amount) * 100),
      minOrderAmount: toPaise(v.minOrder) ?? 0,
      maxDiscountAmount: v.type === "percent" ? toPaise(v.maxDiscount) : null,
      startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : null,
      endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
      usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
      perCustomerLimit: Number(v.perCustomerLimit),
      isActive: v.isActive,
    };
    try {
      if (coupon) await api(`/coupons/${coupon.id}`, { method: "PATCH", body });
      else await api("/coupons", { method: "POST", body });
      await qc.invalidateQueries({ queryKey: ["coupons"] });
      toast.success(coupon ? "Coupon saved" : "Coupon created");
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const map: Record<string, keyof Values> = { value: "amount", minOrderAmount: "minOrder", maxDiscountAmount: "maxDiscount" };
        for (const [k, m] of Object.entries(err.fieldErrors)) if (m?.[0]) setError((map[k] ?? k) as keyof Values, { message: m[0] });
      }
      setError("root", { message: (err as Error).message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={coupon ? `Edit ${coupon.code}` : "New coupon"}>
        <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
          {errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Code" className="uppercase" autoComplete="off" error={errors.code?.message} hint={coupon?.usedCount ? "Used codes can't be renamed." : undefined} {...register("code")} />
            <Select label="Type" {...register("type")}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off</option>
              <option value="free_shipping">Free shipping</option>
            </Select>
            {type !== "free_shipping" && (
              <Input label={type === "percent" ? "Percent off (%)" : "Amount off (₹)"} inputMode="decimal" error={errors.amount?.message} {...register("amount")} />
            )}
            {type === "percent" && <Input label="Maximum discount (₹, optional)" inputMode="decimal" error={errors.maxDiscount?.message} {...register("maxDiscount")} />}
            <Input label="Minimum order (₹, optional)" inputMode="decimal" error={errors.minOrder?.message} {...register("minOrder")} />
            <Input label="Description (optional)" error={errors.description?.message} {...register("description")} />
            <Input label="Starts (optional)" type="datetime-local" error={errors.startsAt?.message} {...register("startsAt")} />
            <Input label="Ends (optional)" type="datetime-local" error={errors.endsAt?.message} {...register("endsAt")} />
            <Input label="Total uses (optional)" inputMode="numeric" hint="Empty = unlimited" error={errors.usageLimit?.message} {...register("usageLimit")} />
            <Input label="Uses per customer" inputMode="numeric" error={errors.perCustomerLimit?.message} {...register("perCustomerLimit")} />
          </div>
          <Checkbox label="Active" {...register("isActive")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {coupon ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function describe(c: Coupon) {
  const off = c.type === "percent" ? `${c.value / 100}% off${c.maxDiscountAmount ? ` (max ${formatPaise(c.maxDiscountAmount)})` : ""}` : c.type === "fixed" ? `${formatPaise(c.value)} off` : "Free shipping";
  return c.minOrderAmount ? `${off} on ${formatPaise(c.minOrderAmount)}+` : off;
}

export function CouponsView() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["coupons", page, q, status],
    queryFn: () => api<Paginated<Coupon>>(`/coupons?${new URLSearchParams({ page: String(page), ...(q ? { q } : {}), ...(status ? { status } : {}) })}`),
    placeholderData: keepPreviousData,
  });
  const [dialog, setDialog] = useState<{ open: boolean; coupon?: Coupon }>({ open: false });

  const columns: DataColumn<Coupon>[] = [
    {
      key: "code",
      header: "Code",
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-mono font-semibold">{c.code}</p>
          <p className="truncate text-xs text-muted-foreground">{describe(c)}</p>
        </div>
      ),
    },
    { key: "state", header: "Status", cell: (c) => <Badge variant={STATE[c.state].variant}>{STATE[c.state].label}</Badge> },
    { key: "used", header: "Used", hideBelow: "sm", cell: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ""}` },
    {
      key: "dates",
      header: "Valid",
      hideBelow: "md",
      cell: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.startsAt ? new Date(c.startsAt).toLocaleDateString("en-IN") : "Now"} → {c.endsAt ? new Date(c.endsAt).toLocaleDateString("en-IN") : "No end"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-14 text-right",
      cell: (c) => (
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.code}`} onClick={() => setDialog({ open: true, coupon: c })}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label="Search"
          icon={<Search className="h-4 w-4" />}
          placeholder="Code"
          value={q}
          onChange={(e) => {
            setQ(e.target.value.toUpperCase());
            setPage(1);
          }}
          className="sm:w-56"
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          containerClassName="sm:w-44"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Off</option>
          <option value="expired">Expired</option>
        </Select>
        <Button className="sm:ml-auto" onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      </div>
      <DataTable
        caption="Coupons"
        columns={columns}
        rows={query.data?.items}
        rowKey={(c) => c.id}
        loading={query.isPending}
        error={query.isError ? (query.error as Error).message : null}
        page={page}
        totalPages={query.data?.totalPages}
        total={query.data?.total}
        onPageChange={setPage}
        empty={{ title: "No coupons yet", description: "Create a promo code to offer a discount or free shipping." }}
      />
      <CouponDialog open={dialog.open} coupon={dialog.coupon} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
    </div>
  );
}
