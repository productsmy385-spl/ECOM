import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABEL, type OrderStatusValue } from "@ecom/validation";

type Variant = "default" | "secondary" | "success" | "danger" | "warning" | "info" | "outline";

const TONE: Record<OrderStatusValue, Variant> = {
  pending: "info",
  payment_pending: "warning",
  confirmed: "info",
  design_review: "secondary",
  design_approved: "secondary",
  production: "default",
  quality_check: "default",
  packed: "default",
  ready_for_dispatch: "default",
  shipped: "info",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "danger",
  return_requested: "warning",
  returned: "outline",
  refunded: "outline",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = status as OrderStatusValue;
  return <Badge variant={TONE[s] ?? "outline"}>{ORDER_STATUS_LABEL[s] ?? status}</Badge>;
}

const PAY: Record<string, { label: string; variant: Variant }> = {
  created: { label: "Unpaid", variant: "warning" },
  authorized: { label: "Authorised", variant: "info" },
  captured: { label: "Paid", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  refunded: { label: "Refunded", variant: "outline" },
  partially_refunded: { label: "Part refunded", variant: "outline" },
};

export function PaymentStatusBadge({ status, provider }: { status: string; provider?: string }) {
  const p = PAY[status] ?? { label: status, variant: "outline" as const };
  const label = provider === "cod" && status === "created" ? "COD due" : p.label;
  return <Badge variant={p.variant}>{label}</Badge>;
}
