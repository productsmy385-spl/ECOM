import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, id, timestamps, ts } from "./_helpers";
import {
  bannerPlacement,
  deliveryStatus,
  notificationChannel,
  ticketPriority,
  ticketStatus,
} from "./enums";
import { orders } from "./commerce";
import { users } from "./users";

// ------------------------------------------------------------- delivery

/** One delivery per order. Captains may only read deliveries where captainId = their id. */
export const deliveries = pgTable(
  "deliveries",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: deliveryStatus("status").notNull().default("unassigned"),
    captainId: uuid("captain_id").references(() => users.id, { onDelete: "set null" }),
    instructions: text("instructions"),
    scheduledFor: ts("scheduled_for"),
    attempts: integer("attempts").notNull().default(0),
    proofUrl: text("proof_url"),
    proofNote: text("proof_note"),
    failureReason: text("failure_reason"),
    pickedUpAt: ts("picked_up_at"),
    deliveredAt: ts("delivered_at"),
    ...timestamps(),
  },
  (t) => [
    index("deliveries_captain_status_idx").on(t.captainId, t.status),
    index("deliveries_status_idx").on(t.status),
  ],
);

/** Assignment history (who was assigned when, by whom). */
export const deliveryAssignments = pgTable(
  "delivery_assignments",
  {
    id: id(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade" }),
    captainId: uuid("captain_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    assignedAt: createdAt(),
    unassignedAt: ts("unassigned_at"),
  },
  (t) => [index("delivery_assignments_delivery_idx").on(t.deliveryId)],
);

export const deliveryStatusHistory = pgTable(
  "delivery_status_history",
  {
    id: id(),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => deliveries.id, { onDelete: "cascade" }),
    fromStatus: deliveryStatus("from_status"),
    toStatus: deliveryStatus("to_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    latitude: varchar("latitude", { length: 20 }),
    longitude: varchar("longitude", { length: 20 }),
    createdAt: createdAt(),
  },
  (t) => [index("delivery_status_history_delivery_idx").on(t.deliveryId, t.createdAt)],
);

// --------------------------------------------------------- notifications

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannel("channel").notNull().default("in_app"),
    type: varchar("type", { length: 64 }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    data: jsonb("data"),
    readAt: ts("read_at"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_unread_idx")
      .on(t.userId, t.createdAt)
      .where(sql`${t.readAt} is null`),
    index("notifications_user_idx").on(t.userId, t.createdAt),
  ],
);

/** FCM device tokens for push notifications. */
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: varchar("platform", { length: 16 }).notNull().default("web"),
    ...timestamps(),
  },
  (t) => [index("push_tokens_user_idx").on(t.userId)],
);

// --------------------------------------------------------------- support

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: id(),
    ticketNumber: varchar("ticket_number", { length: 32 }).notNull().unique(),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    /** Contact-form submissions from guests. */
    guestName: text("guest_name"),
    guestEmail: text("guest_email"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    status: ticketStatus("status").notNull().default("open"),
    priority: ticketPriority("priority").notNull().default("medium"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: ts("resolved_at"),
    ...timestamps(),
  },
  (t) => [
    index("support_tickets_customer_idx").on(t.customerId),
    index("support_tickets_status_idx").on(t.status, t.createdAt),
    index("support_tickets_assignee_idx").on(t.assignedTo),
  ],
);

export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: id(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    isStaff: boolean("is_staff").notNull().default(false),
    /** Internal staff-only note, hidden from the customer. */
    isInternal: boolean("is_internal").notNull().default(false),
    body: text("body").notNull(),
    attachments: jsonb("attachments"),
    createdAt: createdAt(),
  },
  (t) => [index("support_ticket_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

// --------------------------------------------------------------- content

export const banners = pgTable(
  "banners",
  {
    id: id(),
    placement: bannerPlacement("placement").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    ctaLabel: varchar("cta_label", { length: 40 }),
    ctaHref: text("cta_href"),
    imageUrl: text("image_url"),
    mobileImageUrl: text("mobile_image_url"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("banners_placement_idx").on(t.placement, t.isActive, t.sortOrder)],
);

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: id(),
    email: text("email").notNull(),
    unsubscribedAt: ts("unsubscribed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("newsletter_email_lower_uq").on(sql`lower(${t.email})`)],
);

// ---------------------------------------------------------------- system

/** Append-only log of sensitive actions. Never updated or deleted by the app. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorId, t.createdAt),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamps().updatedAt,
});
