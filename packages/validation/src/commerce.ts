import { z } from "zod";
import { addressSchema } from "./account";
import { email, indianPhone, optionalText, uuid } from "./common";

// -------------------------------------------------------------------- cart

export const MAX_LINE_QTY = 10;

export const cartAddSchema = z.object({
  variantId: uuid,
  quantity: z.coerce.number().int().min(1).max(MAX_LINE_QTY).default(1),
  /** Required for products with required customisation options. */
  designId: uuid.optional(),
});
export type CartAddInput = z.input<typeof cartAddSchema>;

export const cartUpdateSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(MAX_LINE_QTY, `At most ${MAX_LINE_QTY} per item`),
});

export const couponCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,40}$/, "Enter a valid code"),
});

// ---------------------------------------------------------------- checkout

export const SHIPPING_METHODS = ["standard", "express"] as const;
export const PAYMENT_METHODS = ["razorpay", "cod"] as const;

const shippingAddressSchema = addressSchema.omit({ label: true, isDefault: true });
export type ShippingAddressInput = z.input<typeof shippingAddressSchema>;
export type ShippingAddress = z.output<typeof shippingAddressSchema>;

export const checkoutSchema = z
  .object({
    /** Generated once per checkout page load; repeat submissions return the same order. */
    idempotencyKey: uuid,
    /** Guests only (signed-in customers use their account email). */
    email: z.union([z.literal(""), email]).optional().transform((v) => (v ? v : undefined)),
    /** A saved address of the signed-in customer, or a new one. */
    savedAddressId: uuid.optional(),
    address: shippingAddressSchema.optional(),
    saveAddress: z.boolean().default(false),
    shippingMethod: z.enum(SHIPPING_METHODS).default("standard"),
    paymentMethod: z.enum(PAYMENT_METHODS),
    note: optionalText(500),
  })
  .refine((v) => !!v.savedAddressId !== !!v.address, { message: "Choose a saved address or enter a new one", path: ["address"] });
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const razorpayVerifySchema = z.object({
  razorpayOrderId: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/, "Invalid payment reference"),
  razorpayPaymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/, "Invalid payment reference"),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/, "Invalid payment signature"),
});

export const guestOrderLookupSchema = z.object({
  orderNumber: z.string().trim().toUpperCase().regex(/^ORD-\d{4}-\d{4,}$/, "Enter your order number"),
  email,
  phone: indianPhone,
});

// ----------------------------------------------------------------- coupons

const paise = (label: string) => z.coerce.number().int(`${label} must be a whole number of paise`).min(0).max(100_000_000);

export const couponSchema = z
  .object({
    code: couponCodeSchema.shape.code,
    description: optionalText(200),
    type: z.enum(["percent", "fixed", "free_shipping"]),
    /** percent: basis points (1000 = 10%); fixed: paise; free_shipping: 0. */
    value: z.coerce.number().int().min(0).max(100_000_000),
    minOrderAmount: paise("Minimum order").default(0),
    maxDiscountAmount: paise("Maximum discount").nullable().optional().transform((v) => v ?? null),
    startsAt: z.coerce.date().nullable().optional().transform((v) => v ?? null),
    endsAt: z.coerce.date().nullable().optional().transform((v) => v ?? null),
    usageLimit: z.coerce.number().int().min(1).max(1_000_000).nullable().optional().transform((v) => v ?? null),
    perCustomerLimit: z.coerce.number().int().min(1).max(100).default(1),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.type === "percent" && (v.value < 1 || v.value > 10_000)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Percent must be between 0.01% and 100%" });
    }
    if (v.type === "fixed" && v.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the discount amount" });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End must be after the start" });
    }
  });
export type CouponInput = z.input<typeof couponSchema>;

export const couponListQuery = z.object({
  q: z.string().trim().max(40).optional(),
  status: z.enum(["active", "inactive", "expired"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------- settings

const dayRange = z
  .tuple([z.coerce.number().int().min(0).max(60), z.coerce.number().int().min(0).max(60)])
  .refine(([a, b]) => a <= b, "The first number must not exceed the second");

export const checkoutSettingsSchema = z
  .object({
    guestCheckoutEnabled: z.boolean(),
    codEnabled: z.boolean(),
    codMaxAmount: paise("COD limit"),
    freeShippingThreshold: paise("Free shipping threshold"),
    standardFee: paise("Standard fee"),
    expressFee: paise("Express fee"),
    standardDays: dayRange,
    expressDays: dayRange,
    paymentHoldMinutes: z.coerce.number().int().min(10).max(1440),
  })
  .strict();
export type CheckoutSettings = z.output<typeof checkoutSettingsSchema>;
