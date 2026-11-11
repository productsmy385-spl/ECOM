/** Customer-facing wording for order statuses. */
export const ORDER_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "muted" }> = {
  pending: { label: "Placed", tone: "info" },
  payment_pending: { label: "Awaiting payment", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  design_review: { label: "Design check", tone: "info" },
  design_approved: { label: "Design approved", tone: "info" },
  production: { label: "Being made", tone: "info" },
  quality_check: { label: "Quality check", tone: "info" },
  packed: { label: "Packed", tone: "info" },
  ready_for_dispatch: { label: "Ready to ship", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  out_for_delivery: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  return_requested: { label: "Return requested", tone: "warning" },
  returned: { label: "Returned", tone: "muted" },
  refunded: { label: "Refunded", tone: "muted" },
};
