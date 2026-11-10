import { auditLogs, type DbOrTx, db, users } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { auditListQuery, type Paginated } from "@ecom/validation";
import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import type { ServiceContext } from "./context";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Append an audit record. Pass the transaction handle so the log row commits
 * (or rolls back) together with the change it describes.
 */
export async function writeAudit(conn: DbOrTx, ctx: ServiceContext, entry: AuditEntry): Promise<void> {
  await conn.insert(auditLogs).values({
    actorId: ctx.actor.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ipAddress: ctx.ip?.slice(0, 64) ?? null,
    userAgent: ctx.userAgent?.slice(0, 500) ?? null,
  });
}

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: Date;
  actor: { id: string; name: string; email: string } | null;
}

export async function listAuditLogs(ctx: ServiceContext, raw: unknown): Promise<Paginated<AuditLogRow>> {
  requirePermission(ctx.actor, "audit_logs.view");
  const q = auditListQuery.parse(raw);

  const filters: SQL[] = [];
  if (q.entityType) filters.push(eq(auditLogs.entityType, q.entityType));
  if (q.action) filters.push(eq(auditLogs.action, q.action));
  if (q.actorId) filters.push(eq(auditLogs.actorId, q.actorId));
  if (q.from) filters.push(gte(auditLogs.createdAt, q.from));
  if (q.to) filters.push(lte(auditLogs.createdAt, q.to));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        before: auditLogs.before,
        after: auditLogs.after,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        actorId: users.id,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(auditLogs).where(where),
  ]);

  const total = totalRow?.n ?? 0;
  return {
    items: rows.map(({ actorId, actorName, actorEmail, ...r }) => ({
      ...r,
      actor: actorId ? { id: actorId, name: actorName!, email: actorEmail! } : null,
    })),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/** Distinct values for the audit filter dropdowns. */
export async function auditFacets(ctx: ServiceContext) {
  requirePermission(ctx.actor, "audit_logs.view");
  const [actions, entities] = await Promise.all([
    db.selectDistinct({ v: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action),
    db.selectDistinct({ v: auditLogs.entityType }).from(auditLogs).orderBy(auditLogs.entityType),
  ]);
  return { actions: actions.map((a) => a.v), entityTypes: entities.map((e) => e.v) };
}
