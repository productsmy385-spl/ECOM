import { Badge } from "@/components/ui/badge";

export const DESIGN_STATUS: Record<string, { label: string; variant: "warning" | "info" | "success" | "danger" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  submitted: { label: "Awaiting assignment", variant: "warning" },
  in_review: { label: "In review", variant: "info" },
  awaiting_customer: { label: "Awaiting customer", variant: "secondary" },
  changes_requested: { label: "Changes requested", variant: "secondary" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

export function DesignStatusBadge({ status }: { status: string }) {
  const s = DESIGN_STATUS[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
