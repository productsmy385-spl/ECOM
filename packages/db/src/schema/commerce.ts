import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, timestamps, ts } from "./_helpers";
import {
  couponType,
  orderStatus,
  paymentProvider,
  paymentStatus,
  refundStatus,
} from "./enums";
import { products, productVariants } from "./catalog";
import { customerDesigns, designVersions } from "./designs";
import { users } from "./users";

// ----------------------------------------------------------------- cart

/** One cart per customer, or per guest token for anonymous shoppers. */
export const carts = pgTable(
  "carts",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    guestToken: varchar("guest_token", { length: 64 }),
    couponCode: varchar("coupon_code", { length: 40 }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("carts_user_uq").on(t.userId).where(sql`${t.userId} is not null`),
    uniqueIndex("carts_guest_uq").on(t.guestToken).where(sql`${t.guestToken} is not null`),
    check("carts_owner_present", sql`${t.userId} is not null or ${t.guestToken} is not null`),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: id(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    /** Selected customization option values (structured, validated). */
    customization: jsonb("customization"),
    designId: uuid("design_id").references(() => customerDesigns.id, { onDelete: "set null" }),
    designVersionId: uuid("design_version_id").references(() => designVersions.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    index("cart_items_cart_idx").on(t.cartId),
    check("cart_items_qty_range", sql`${t.quantity} between 1 and 99`),
  ],
);

// ------------------------------------------------------------- wishlist

export const wishlists = pgTable("wishlists", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  ...timestamps(),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: id(),
    wishlistId: uuid("wishlist_id")
      .notNull()
      .references(() => wishlists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wishlist_items_uq").on(t.wishlistId, t.productId)],
);

// --------------------------------------------------------------- coupons

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: varchar("code", { length: 40 }).notNull(),
    description: text("description"),
    type: couponType("type").notNull(),
    /** percent: basis points (1000 = 10%); fixed: paise; free_shipping: ignored. */
    value: integer("value").notNull().default(0),
    minOrderAmount: integer("min_order_amount").notNull().default(0),
    maxDiscountAmount: integer("max_discount_amount"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("coupons_code_upper_uq").on(sql`upper(${t.code})`),
    check("coupons_value_nonneg", sql`${t.value} >= 0`),
  ],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: id(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    discountAmount: integer("discount_amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("coupon_redemptions_coupon_user_idx").on(t.couponId, t.userId)],
);

// ---------------------------------------------------------------- orders

/** Order numbers: ORD-<year>-<seq>. A sequence never hands out the same value twice, even under concurrency. */
export const orderNumberSeq = pgSequence("order_number_seq", { startWith: 1001, increment: 1 });

export const orders = pgTable(
  "orders",
  {
    id: id(),
    /** Human-friendly unique number, e.g. ORD-2026-000123. */
    orderNumber: varchar("order_number", { length: 32 }).notNull().unique(),
    /** Null for guest checkout. */
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    guestEmail: text("guest_email"),
    guestPhone: varchar("guest_phone", { length: 20 }),
    /**
     * SHA-256 of the random token in a guest's order link (the token itself is
     * never stored). Lets guests view their order without an account.
     */
    guestAccessHash: varchar("guest_access_hash", { length: 64 }),
    status: orderStatus("status").notNull().default("pending"),
    paymentStatus: paymentStatus("payment_status").notNull().default("created"),
    paymentProvider: paymentProvider("payment_provider").notNull(),
    /** Address snapshots: orders keep the address used even if the customer edits it later. */
    shippingAddress: jsonb("shipping_address").notNull(),
    billingAddress: jsonb("billing_address"),
    shippingMethod: varchar("shipping_method", { length: 40 }).notNull().default("standard"),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    /** All amounts in paise. total = subtotal - discount + shipping (tax is GST-inclusive in subtotal). */
    subtotal: integer("subtotal").notNull(),
    discountAmount: integer("discount_amount").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    shippingAmount: integer("shipping_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull(),
    couponCode: varchar("coupon_code", { length: 40 }),
    requiresDesignReview: boolean("requires_design_review").notNull().default(false),
    customerNote: text("customer_note"),
    /** Client-generated key; repeated checkout submissions return the same order. */
    idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull().unique(),
    assignedStaffId: uuid("assigned_staff_id").references(() => users.id, { onDelete: "set null" }),
    placedAt: ts("placed_at").notNull().defaultNow(),
    confirmedAt: ts("confirmed_at"),
    deliveredAt: ts("delivered_at"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    ...timestamps(),
  },
  (t) => [
    index("orders_customer_idx").on(t.customerId, t.placedAt),
    index("orders_status_idx").on(t.status, t.placedAt),
    index("orders_placed_at_idx").on(t.placedAt),
    index("orders_assigned_staff_idx").on(t.assignedStaffId),
    check("orders_owner_present", sql`${t.customerId} is not null or ${t.guestEmail} is not null`),
    check("orders_total_nonneg", sql`${t.totalAmount} >= 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "restrict" }),
    /** Snapshots so invoices never change if the catalog does. */
    productName: text("product_name").notNull(),
    variantName: text("variant_name").notNull(),
    sku: varchar("sku", { length: 64 }).notNull(),
    imageUrl: text("image_url"),
    unitPrice: integer("unit_price").notNull(),
    customizationPrice: integer("customization_price").notNull().default(0),
    quantity: integer("quantity").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull(),
    taxAmount: integer("tax_amount").notNull(),
    lineTotal: integer("line_total").notNull(),
    /** Full structured customization snapshot — enough to reproduce the product. */
    customization: jsonb("customization"),
    designId: uuid("design_id").references(() => customerDesigns.id, { onDelete: "set null" }),
    designVersionId: uuid("design_version_id").references(() => designVersions.id, {
      onDelete: "set null",
    }),
    requiresDesignReview: boolean("requires_design_review").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_product_idx").on(t.productId),
    check("order_items_qty_pos", sql`${t.quantity} > 0`),
  ],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    /** Visible to the customer on the tracking page. */
    isCustomerVisible: boolean("is_customer_visible").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId, t.createdAt)],
);

/** Internal notes — never returned by customer-facing APIs. */
export const orderNotes = pgTable(
  "order_notes",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("order_notes_order_idx").on(t.orderId)],
);

// -------------------------------------------------------------- payments

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    provider: paymentProvider("provider").notNull(),
    status: paymentStatus("status").notNull().default("created"),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    razorpayOrderId: varchar("razorpay_order_id", { length: 64 }).unique(),
    razorpayPaymentId: varchar("razorpay_payment_id", { length: 64 }).unique(),
    method: varchar("method", { length: 32 }),
    failureReason: text("failure_reason"),
    /** Set only after server-side signature or webhook verification. */
    verifiedAt: ts("verified_at"),
    capturedAt: ts("captured_at"),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    raw: jsonb("raw"),
    ...timestamps(),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_status_idx").on(t.status, t.createdAt),
    check("payments_refund_lte_amount", sql`${t.refundedAmount} <= ${t.amount}`),
  ],
);

/** Webhook events, stored once per provider event id for idempotent processing. */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: id(),
    provider: paymentProvider("provider").notNull(),
    eventId: varchar("event_id", { length: 128 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: ts("processed_at"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payment_events_provider_event_uq").on(t.provider, t.eventId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    status: refundStatus("status").notNull().default("requested"),
    reason: text("reason"),
    razorpayRefundId: varchar("razorpay_refund_id", { length: 64 }).unique(),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    processedAt: ts("processed_at"),
    ...timestamps(),
  },
  (t) => [
    index("refunds_order_idx").on(t.orderId),
    check("refunds_amount_pos", sql`${t.amount} > 0`),
  ],
);
