/**
 * Help centre / support tickets.
 * Customers open tickets (optionally about one of their orders) and reply;
 * staff with support.view read them, support.manage reply (publicly or as an
 * internal note), assign, prioritise and resolve. Internal notes never reach
 * the customer.
 */
import { randomBytes } from "node:crypto";
import { db, orders, supportTicketMessages, supportTickets, users } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { ticketCreateSchema, ticketReplySchema, ticketUpdateSchema } from "@ecom/validation";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { CustomerContext } from "./account";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { NotFoundError, ValidationError } from "./errors";
import { notifyStaffWith, notifyUsers, staffWith } from "./notifications";

export type TicketStatus = "open" | "in_progress" | "awaiting_customer" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  awaiting_customer: "Waiting for you",
  resolved: "Resolved",
  closed: "Closed",
};

function ticketNumber() {
  const d = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10).replace(/-/g, "");
  return `TCK-${d}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export interface TicketMessage {
  id: string;
  body: string;
  isStaff: boolean;
  isInternal: boolean;
  author: string;
  createdAt: Date;
}

export interface TicketDetail {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
  updatedAt: Date;
  order: { id: string; orderNumber: string } | null;
  customer: { id: string | null; name: string; email: string | null };
  assignee: { id: string; name: string } | null;
  messages: TicketMessage[];
}

// ------------------------------------------------------------------ customer

export async function createTicket(c: CustomerContext, raw: unknown) {
  const input = ticketCreateSchema.parse(raw);
  let orderId: string | null = null;
  if (input.orderNumber) {
    const [o] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.orderNumber, input.orderNumber), eq(orders.customerId, c.userId)));
    if (!o) throw new ValidationError("We couldn't find that order on your account.", { orderNumber: ["Not one of your orders"] });
    orderId = o.id;
  }
  const priority: TicketPriority = input.topic === "Return or damage" || input.topic === "Payment or refund" ? "high" : "medium";
  return db.transaction(async (tx) => {
    const [t] = await tx
      .insert(supportTickets)
      .values({ ticketNumber: ticketNumber(), customerId: c.userId, orderId, subject: `${input.topic}: ${input.subject}`, priority })
      .returning({ id: supportTickets.id, ticketNumber: supportTickets.ticketNumber });
    await tx.insert(supportTicketMessages).values({ ticketId: t!.id, authorId: c.userId, isStaff: false, body: input.message });
    await notifyStaffWith(tx, ["support.manage"], { type: "ticket.new", title: `New ticket ${t!.ticketNumber}`, body: input.subject, link: `/support/${t!.id}` }, null);
    return t!;
  });
}

export async function listMyTickets(c: CustomerContext) {
  return db
    .select({
      id: supportTickets.id,
      ticketNumber: supportTickets.ticketNumber,
      subject: supportTickets.subject,
      status: supportTickets.status,
      updatedAt: supportTickets.updatedAt,
      createdAt: supportTickets.createdAt,
    })
    .from(supportTickets)
    .where(eq(supportTickets.customerId, c.userId))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(100);
}

async function loadTicket(where: SQL, includeInternal: boolean): Promise<TicketDetail> {
  const assignee = alias(users, "assignee");
  const [t] = await db
    .select({
      id: supportTickets.id,
      ticketNumber: supportTickets.ticketNumber,
      subject: supportTickets.subject,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      customerId: supportTickets.customerId,
      customerName: sql<string>`coalesce(${users.name}, ${supportTickets.guestName}, 'Guest')`,
      customerEmail: sql<string | null>`coalesce(${users.email}, ${supportTickets.guestEmail})`,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
    })
    .from(supportTickets)
    .leftJoin(users, eq(users.id, supportTickets.customerId))
    .leftJoin(assignee, eq(assignee.id, supportTickets.assignedTo))
    .leftJoin(orders, eq(orders.id, supportTickets.orderId))
    .where(where);
  if (!t) throw new NotFoundError("Ticket not found.");
  const author = alias(users, "author");
  const msgs = await db
    .select({
      id: supportTicketMessages.id,
      body: supportTicketMessages.body,
      isStaff: supportTicketMessages.isStaff,
      isInternal: supportTicketMessages.isInternal,
      author: sql<string>`coalesce(${author.name}, 'Customer')`,
      createdAt: supportTicketMessages.createdAt,
    })
    .from(supportTicketMessages)
    .leftJoin(author, eq(author.id, supportTicketMessages.authorId))
    .where(and(eq(supportTicketMessages.ticketId, t.id), includeInternal ? undefined : eq(supportTicketMessages.isInternal, false)))
    .orderBy(asc(supportTicketMessages.createdAt));
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    order: t.orderId && t.orderNumber ? { id: t.orderId, orderNumber: t.orderNumber } : null,
    customer: { id: t.customerId, name: t.customerName, email: t.customerEmail },
    assignee: t.assigneeId && t.assigneeName ? { id: t.assigneeId, name: t.assigneeName } : null,
    // Customers see staff replies signed by the store, not by the agent's name.
    messages: includeInternal ? msgs : msgs.map((m) => (m.isStaff ? { ...m, author: "Support team" } : m)),
  };
}

export async function getMyTicket(c: CustomerContext, id: string) {
  return loadTicket(and(eq(supportTickets.id, id), eq(supportTickets.customerId, c.userId))!, false);
}

export async function replyMyTicket(c: CustomerContext, id: string, raw: unknown) {
  const { message } = ticketReplySchema.parse(raw);
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(supportTickets).where(and(eq(supportTickets.id, id), eq(supportTickets.customerId, c.userId))).for("update");
    if (!t) throw new NotFoundError("Ticket not found.");
    await tx.insert(supportTicketMessages).values({ ticketId: id, authorId: c.userId, isStaff: false, body: message });
    // A customer reply re-opens a resolved ticket and hands it back to the team.
    const status: TicketStatus = t.status === "closed" || t.status === "resolved" || t.status === "awaiting_customer" ? "open" : t.status;
    await tx.update(supportTickets).set({ status, resolvedAt: null, updatedAt: new Date() }).where(eq(supportTickets.id, id));
    const to = t.assignedTo ? [t.assignedTo] : await staffWith(tx, ["support.manage"]);
    await notifyUsers(tx, to, { type: "ticket.reply", title: `Customer replied on ${t.ticketNumber}`, body: message.slice(0, 120), link: `/support/${id}` });
  });
  return getMyTicket(c, id);
}

// --------------------------------------------------------------------- staff

export async function listTicketsAdmin(ctx: ServiceContext, q: { status?: string; mine?: string; page?: string }) {
  requirePermission(ctx.actor, "support.view");
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = 25;
  const open = ["open", "in_progress", "awaiting_customer"] as const;
  const conds: SQL[] = [];
  if (q.status === "closed") conds.push(inArray(supportTickets.status, ["resolved", "closed"]));
  else if (q.status && (open as readonly string[]).includes(q.status)) conds.push(eq(supportTickets.status, q.status as TicketStatus));
  else conds.push(inArray(supportTickets.status, [...open]));
  if (q.mine === "1") conds.push(eq(supportTickets.assignedTo, ctx.actor.userId));
  const where = and(...conds);
  const assignee = alias(users, "assignee");
  const [items, [total]] = await Promise.all([
    db
      .select({
        id: supportTickets.id,
        ticketNumber: supportTickets.ticketNumber,
        subject: supportTickets.subject,
        status: supportTickets.status,
        priority: supportTickets.priority,
        updatedAt: supportTickets.updatedAt,
        customer: sql<string>`coalesce(${users.name}, ${supportTickets.guestName}, 'Guest')`,
        assignee: assignee.name,
        messages: sql<number>`(select count(*)::int from support_ticket_messages m where m.ticket_id = "support_tickets"."id" and not m.is_internal)`,
      })
      .from(supportTickets)
      .leftJoin(users, eq(users.id, supportTickets.customerId))
      .leftJoin(assignee, eq(assignee.id, supportTickets.assignedTo))
      .where(where)
      .orderBy(sql`case ${supportTickets.priority} when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end`, desc(supportTickets.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(supportTickets).where(where),
  ]);
  return { items, total: total?.n ?? 0, page, pageSize };
}

export async function getTicketAdmin(ctx: ServiceContext, id: string) {
  requirePermission(ctx.actor, "support.view");
  return loadTicket(eq(supportTickets.id, id), true);
}

export async function listSupportAgents(ctx: ServiceContext) {
  requirePermission(ctx.actor, "support.view");
  const ids = await staffWith(db, ["support.manage"]);
  if (!ids.length) return [];
  return db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids)).orderBy(asc(users.name));
}

export async function replyTicketAdmin(ctx: ServiceContext, id: string, raw: unknown) {
  requirePermission(ctx.actor, "support.manage");
  const input = ticketReplySchema.parse(raw);
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(supportTickets).where(eq(supportTickets.id, id)).for("update");
    if (!t) throw new NotFoundError("Ticket not found.");
    await tx.insert(supportTicketMessages).values({ ticketId: id, authorId: ctx.actor.userId, isStaff: true, isInternal: input.internal, body: input.message });
    const set: Partial<typeof supportTickets.$inferInsert> = { updatedAt: new Date() };
    if (!input.internal) {
      set.status = "awaiting_customer";
      if (!t.assignedTo) set.assignedTo = ctx.actor.userId;
      if (t.customerId) await notifyUsers(tx, [t.customerId], { type: "ticket.reply", title: `We replied to ${t.ticketNumber}`, body: input.message.slice(0, 120), link: `/account/support/${id}` });
    }
    await tx.update(supportTickets).set(set).where(eq(supportTickets.id, id));
  });
  return getTicketAdmin(ctx, id);
}

export async function updateTicket(ctx: ServiceContext, id: string, raw: unknown) {
  requirePermission(ctx.actor, "support.manage");
  const input = ticketUpdateSchema.parse(raw);
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(supportTickets).where(eq(supportTickets.id, id)).for("update");
    if (!t) throw new NotFoundError("Ticket not found.");
    if (input.assignedTo) {
      const agents = await staffWith(tx, ["support.manage"]);
      if (!agents.includes(input.assignedTo)) throw new ValidationError("That person can't handle support tickets.", { assignedTo: ["Not a support agent"] });
    }
    const set: Partial<typeof supportTickets.$inferInsert> = { updatedAt: new Date() };
    if (input.status) {
      set.status = input.status;
      set.resolvedAt = input.status === "resolved" || input.status === "closed" ? new Date() : null;
    }
    if (input.priority) set.priority = input.priority;
    if (input.assignedTo !== undefined) set.assignedTo = input.assignedTo;
    await tx.update(supportTickets).set(set).where(eq(supportTickets.id, id));
    await writeAudit(tx, ctx, { action: "ticket.update", entityType: "support_ticket", entityId: id, before: { status: t.status, priority: t.priority, assignedTo: t.assignedTo }, after: input });
    if (input.assignedTo && input.assignedTo !== ctx.actor.userId) {
      await notifyUsers(tx, [input.assignedTo], { type: "ticket.assigned", title: `${t.ticketNumber} assigned to you`, body: t.subject, link: `/support/${id}` });
    }
  });
  return getTicketAdmin(ctx, id);
}
