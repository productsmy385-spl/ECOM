export const CUSTOMER_STATUS: Record<string, { label: string; tone: string; text: string }> = {
  draft: { label: "Draft", tone: "bg-muted text-foreground", text: "Saved but not finished. Keep editing whenever you like." },
  submitted: { label: "Submitted", tone: "bg-info/10 text-info", text: "Received. A designer will review it shortly." },
  in_review: { label: "In review", tone: "bg-info/10 text-info", text: "A designer is reviewing your design." },
  awaiting_customer: { label: "Needs your OK", tone: "bg-warning/10 text-warning", text: "Please review the latest version." },
  changes_requested: { label: "Changes requested", tone: "bg-warning/10 text-warning", text: "Our team suggested a change. Edit and resubmit." },
  approved: { label: "Approved", tone: "bg-success/10 text-success", text: "Ready to be made. Ordering opens with checkout." },
  rejected: { label: "Not accepted", tone: "bg-destructive/10 text-destructive", text: "We can't produce this design. See the note below." },
};
