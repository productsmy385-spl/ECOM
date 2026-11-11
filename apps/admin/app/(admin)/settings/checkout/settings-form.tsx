"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api-client";
import type { CheckoutSettings } from "@ecom/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount in rupees");
const day = z.string().trim().regex(/^\d{1,2}$/, "Days");
const schema = z
  .object({
    guestCheckoutEnabled: z.boolean(),
    codEnabled: z.boolean(),
    codMax: money,
    freeThreshold: money,
    standardFee: money,
    expressFee: money,
    standardMin: day,
    standardMax: day,
    expressMin: day,
    expressMax: day,
    holdMinutes: z.string().trim().regex(/^\d{2,4}$/, "10–1440 minutes"),
  })
  .refine((v) => Number(v.standardMin) <= Number(v.standardMax), { path: ["standardMax"], message: "Must be ≥ the minimum" })
  .refine((v) => Number(v.expressMin) <= Number(v.expressMax), { path: ["expressMax"], message: "Must be ≥ the minimum" });
type Values = z.infer<typeof schema>;

const r = (p: number) => String(p / 100);
const p = (v: string) => Math.round(Number(v) * 100);

export function CheckoutSettingsForm({ initial, razorpayConfigured }: { initial: CheckoutSettings; razorpayConfigured: boolean }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      guestCheckoutEnabled: initial.guestCheckoutEnabled,
      codEnabled: initial.codEnabled,
      codMax: r(initial.codMaxAmount),
      freeThreshold: r(initial.freeShippingThreshold),
      standardFee: r(initial.standardFee),
      expressFee: r(initial.expressFee),
      standardMin: String(initial.standardDays[0]),
      standardMax: String(initial.standardDays[1]),
      expressMin: String(initial.expressDays[0]),
      expressMax: String(initial.expressDays[1]),
      holdMinutes: String(initial.paymentHoldMinutes),
    },
  });

  async function submit(v: Values) {
    const body: CheckoutSettings = {
      guestCheckoutEnabled: v.guestCheckoutEnabled,
      codEnabled: v.codEnabled,
      codMaxAmount: p(v.codMax),
      freeShippingThreshold: p(v.freeThreshold),
      standardFee: p(v.standardFee),
      expressFee: p(v.expressFee),
      standardDays: [Number(v.standardMin), Number(v.standardMax)],
      expressDays: [Number(v.expressMin), Number(v.expressMax)],
      paymentHoldMinutes: Number(v.holdMinutes),
    };
    try {
      await api("/settings/checkout", { method: "PUT", body });
      reset(v);
      toast.success("Checkout settings saved");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.paymentHoldMinutes) setError("holdMinutes", { message: err.fieldErrors.paymentHoldMinutes[0] });
      setError("root", { message: (err as Error).message });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Payments</h2>
        <p className={`mt-2 flex items-start gap-2 text-sm ${razorpayConfigured ? "text-success" : "text-warning"}`}>
          {razorpayConfigured ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {razorpayConfigured
            ? "Online payments (Razorpay) are configured."
            : "Online payments are off until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set on the storefront service. Shoppers can't pay online meanwhile."}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Checkbox label="Offer cash on delivery" {...register("codEnabled")} />
          <Input label="COD limit (₹)" inputMode="decimal" hint="Orders above this must be paid online." error={errors.codMax?.message} {...register("codMax")} />
          <Input
            label="Payment hold (minutes)"
            inputMode="numeric"
            hint="Unpaid online orders release their stock after this."
            error={errors.holdMinutes?.message}
            {...register("holdMinutes")}
          />
          <Checkbox label="Allow guest checkout (no account)" {...register("guestCheckoutEnabled")} />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Shipping</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Input label="Free standard shipping from (₹)" inputMode="decimal" error={errors.freeThreshold?.message} {...register("freeThreshold")} />
          <Input label="Standard fee (₹)" inputMode="decimal" error={errors.standardFee?.message} {...register("standardFee")} />
          <Input label="Express fee (₹)" inputMode="decimal" error={errors.expressFee?.message} {...register("expressFee")} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Input label="Standard: min days" inputMode="numeric" error={errors.standardMin?.message} {...register("standardMin")} />
          <Input label="Standard: max days" inputMode="numeric" error={errors.standardMax?.message} {...register("standardMax")} />
          <Input label="Express: min days" inputMode="numeric" error={errors.expressMin?.message} {...register("expressMin")} />
          <Input label="Express: max days" inputMode="numeric" error={errors.expressMax?.message} {...register("expressMax")} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting} disabled={!isDirty}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
