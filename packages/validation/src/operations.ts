import { z } from "zod";
import { email, indianPhone, optionalText, uuid } from "./common";

// ------------------------------------------------------------------ orders

export const ORDER_STATUSES = [
  "pending",
  "payment_pending",
  "confirmed",
  "design_review",
  "design_approved",
  "production",
  "quality_check",
  "packed",
  "ready_for_dispatch",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
  "refunded",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/**
 * Allowed manual transitions. Payment moves payment_pending forward (never a
 * person), and "refunded" is reached only through a refund.
 */
export const ORDER_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  pending: ["confirmed", "cancelled"],
  payment_pending: ["cancelled"],
  confirmed: ["production", "packed", "cancelled"],
  design_review: ["design_approved", "cancelled"],
  design_approved: ["production", "cancelled"],
  production: ["quality_check", "cancelled"],
  quality_check: ["packed", "production"],
  packed: ["ready_for_dispatch", "shipped", "cancelled"],
  ready_for_dispatch: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: ["return_requested"],
  return_requested: ["returned", "delivered"],
  returned: [],
  cancelled: [],
  refunded: [],
};

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  pending: "Placed",
  payment_pending: "Awaiting payment",
  confirmed: "Confirmed",
  design_review: "Design review",
  design_approved: "Design approved",
  production: "In production",
  quality_check: "Quality check",
  packed: "Packed",
  ready_for_dispatch: "Ready to dispatch",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return requested",
  returned: "Returned",
  refunded: "Refunded",
};

export const orderListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  payment: z.enum(["created", "authorized", "captured", "failed", "refunded", "partially_refunded"]).optional(),
  method: z.enum(["razorpay", "cod"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  mine: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const orderStatusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(500),
  /** Shown on the customer's order page (default) or kept internal. */
  notifyCustomer: z.boolean().default(true),
});

export const orderNoteSchema = z.object({ body: z.string().trim().min(1, "Write a note").max(2000) });
export const orderAssignSchema = z.object({ staffId: uuid.nullable() });

export const refundSchema = z.object({
  /** Paise. */
  amount: z.coerce.number().int().min(1, "Enter an amount"),
  reason: z.string().trim().min(3, "Give a reason").max(500),
});

// --------------------------------------------------------------- customers

export const customerListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const customerStatusSchema = z.object({ active: z.boolean(), reason: optionalText(300) });

// --------------------------------------------------------------- inventory

export const stockListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  low: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export const minStockSchema = z.object({ minStock: z.coerce.number().int().min(0).max(100_000) });

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  contactName: optionalText(120),
  email: z.union([z.literal(""), email]).optional().transform((v) => (v ? v : undefined)),
  phone: z.union([z.literal(""), indianPhone]).optional().transform((v) => (v ? v : undefined)),
  gstin: z
    .union([z.literal(""), z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  address: optionalText(500),
  notes: optionalText(1000),
  isActive: z.boolean().default(true),
});

export const purchaseSchema = z.object({
  supplierId: uuid,
  reference: optionalText(64),
  notes: optionalText(1000),
  items: z
    .array(
      z.object({
        variantId: uuid,
        quantity: z.coerce.number().int().min(1).max(100_000),
        /** Paise. */
        unitCost: z.coerce.number().int().min(0).max(100_000_000),
      }),
    )
    .min(1, "Add at least one item")
    .max(200),
});
export const purchaseActionSchema = z.object({ action: z.enum(["order", "receive", "cancel"]) });

// -------------------------------------------------------------- deliveries

export const DELIVERY_STATUSES = ["unassigned", "assigned", "picked_up", "in_transit", "out_for_delivery", "delivered", "failed"] as const;

export const deliveryListQuery = z.object({
  status: z.enum(DELIVERY_STATUSES).optional(),
  /** "open" = not delivered and not failed. */
  open: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const deliveryAssignSchema = z.object({ captainId: uuid.nullable(), instructions: optionalText(500) });

const coord = z.coerce.number().min(-180).max(180).optional();
export const deliveryUpdateSchema = z.object({
  action: z.enum(["picked_up", "out_for_delivery", "delivered", "failed", "reattempt"]),
  note: optionalText(500),
  /** Photo proof uploaded to ImageKit (optional). */
  proofUrl: z.url().refine((u) => /^https:\/\/ik\.imagekit\.io\//.test(u), "Upload the photo first").optional(),
  /** COD orders: the captain confirms the cash was collected. */
  codCollected: z.boolean().optional(),
  latitude: coord,
  longitude: coord,
});
