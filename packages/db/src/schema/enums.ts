import { pgEnum } from "drizzle-orm/pg-core";

export const userStatus = pgEnum("user_status", ["active", "suspended"]);

export const productStatus = pgEnum("product_status", ["draft", "published", "archived"]);

export const customizationOptionType = pgEnum("customization_option_type", [
  "select", // pick one of config.choices
  "multiselect",
  "color", // pick a colour swatch from config.choices
  "text", // free text (engraving, personal text, brand name)
  "number",
  "image", // customer upload (stored in ImageKit)
  "prescription", // structured eyeglass prescription
  "canvas", // visual design editor (layers)
]);

export const designStatus = pgEnum("design_status", [
  "draft",
  "submitted",
  "in_review",
  "awaiting_customer",
  "changes_requested",
  "approved",
  "rejected",
]);

export const designAuthorType = pgEnum("design_author_type", ["customer", "designer"]);

export const approvalDecision = pgEnum("approval_decision", [
  "approved",
  "changes_requested",
  "rejected",
]);

export const orderStatus = pgEnum("order_status", [
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
]);

export const paymentProvider = pgEnum("payment_provider", ["razorpay", "cod"]);

export const paymentStatus = pgEnum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const refundStatus = pgEnum("refund_status", [
  "requested",
  "approved",
  "processing",
  "processed",
  "failed",
  "rejected",
]);

export const couponType = pgEnum("coupon_type", ["percent", "fixed", "free_shipping"]);

export const inventoryMovementType = pgEnum("inventory_movement_type", [
  "purchase", // stock received from supplier (+on_hand)
  "adjustment", // manual correction (+/- on_hand)
  "reservation", // order placed (+reserved)
  "release", // reservation released, e.g. cancelled/failed payment (-reserved)
  "fulfillment", // shipped: -on_hand and -reserved
  "return", // returned to stock (+on_hand)
]);

export const purchaseStatus = pgEnum("purchase_status", ["draft", "ordered", "received", "cancelled"]);

export const deliveryStatus = pgEnum("delivery_status", [
  "unassigned",
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
]);

export const reviewStatus = pgEnum("review_status", ["pending", "approved", "rejected"]);

export const notificationChannel = pgEnum("notification_channel", ["in_app", "email", "push"]);

export const ticketStatus = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "awaiting_customer",
  "resolved",
  "closed",
]);

export const ticketPriority = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);

export const bannerPlacement = pgEnum("banner_placement", ["hero", "promo", "category"]);
