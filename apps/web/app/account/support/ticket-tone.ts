/** Badge colours per ticket status (customer views). */
export const TICKET_TONE: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  awaiting_customer: "bg-warning/15 text-warning",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};
