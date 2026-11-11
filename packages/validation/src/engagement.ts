/** Customer engagement: reviews, order self-service and support tickets. */
import { z } from "zod";

export const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose 1 to 5 stars").max(5, "Choose 1 to 5 stars"),
  title: z.string().trim().max(120, "At most 120 characters").default(""),
  body: z.string().trim().min(10, "Tell others a little more (at least 10 characters)").max(2000, "At most 2000 characters"),
});
export type ReviewInput = z.output<typeof reviewInputSchema>;

export const reviewModerationSchema = z.object({ decision: z.enum(["approved", "rejected"]) });

export const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery is too slow", "Want to change the design or size", "Other"] as const;
export const RETURN_REASONS = ["Arrived damaged or broken", "Wrong item received", "Not as shown or described", "Print or design error", "Other"] as const;

export const orderCancelSchema = z.object({
  reason: z.enum(CANCEL_REASONS),
  details: z.string().trim().max(500).default(""),
});
export const orderReturnSchema = z.object({
  reason: z.enum(RETURN_REASONS),
  details: z.string().trim().min(10, "Describe the problem (at least 10 characters)").max(1000),
});

/** Days after delivery during which a return can be requested. */
export const RETURN_WINDOW_DAYS = 7;

export const TICKET_TOPICS = ["Order or delivery", "Custom design", "Payment or refund", "Return or damage", "Product question", "Other"] as const;

export const ticketCreateSchema = z.object({
  topic: z.enum(TICKET_TOPICS),
  subject: z.string().trim().min(5, "Add a short subject").max(140),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(4000),
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(ORD-\d{4}-\d{6})?$/, "Order numbers look like ORD-2026-000123")
    .default(""),
});
export const ticketReplySchema = z.object({
  message: z.string().trim().min(2, "Write a reply").max(4000),
  /** Staff only: note not shown to the customer. */
  internal: z.boolean().default(false),
});
export const ticketUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "awaiting_customer", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.uuid().nullable().optional(),
});
