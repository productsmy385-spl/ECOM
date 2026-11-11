import { coupons, db } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { couponListQuery, couponSchema, type Paginated } from "@ecom/validation";
import { and, count, desc, eq, gt, ilike, isNull, lte, or, type SQL } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { ConflictError, NotFoundError, uniqueViolation } from "./errors";

export type CouponRow = typeof coupons.$inferSelect;

function view(c: CouponRow) {
  const now = new Date();
  const state = !c.isActive ? "inactive" : c.endsAt && c.endsAt <= now ? "expired" : c.startsAt && c.startsAt > now ? "scheduled" : c.usageLimit !== null && c.usedCount >= c.usageLimit ? "used_up" : "active";
  return { ...c, code: c.code.toUpperCase(), state };
}
export type CouponView = ReturnType<typeof view>;

export async function listCoupons(ctx: ServiceContext, raw: unknown): Promise<Paginated<CouponView>> {
  requirePermission(ctx.actor, "marketing.manage");
  const q = couponListQuery.parse(raw);
  const now = new Date();
  const filters: (SQL | undefined)[] = [];
  if (q.q) filters.push(ilike(coupons.code, `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
  if (q.status === "active") filters.push(and(eq(coupons.isActive, true), or(isNull(coupons.endsAt), gt(coupons.endsAt, now))));
  if (q.status === "inactive") filters.push(eq(coupons.isActive, false));
  if (q.status === "expired") filters.push(lte(coupons.endsAt, now));
  const where = and(...filters);
  const [rows, [t]] = await Promise.all([
    db.select().from(coupons).where(where).orderBy(desc(coupons.createdAt)).limit(q.pageSize).offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(coupons).where(where),
  ]);
  const total = t?.n ?? 0;
  return { items: rows.map(view), page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function createCoupon(ctx: ServiceContext, raw: unknown): Promise<CouponView> {
  requirePermission(ctx.actor, "marketing.manage");
  const input = couponSchema.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      const [c] = await tx.insert(coupons).values({ ...input, description: input.description ?? null }).returning();
      await writeAudit(tx, ctx, { action: "coupon.create", entityType: "coupon", entityId: c!.id, after: input });
      return view(c!);
    });
  } catch (err) {
    if (uniqueViolation(err)) throw new ConflictError("A coupon with this code already exists.");
    throw err;
  }
}

export async function updateCoupon(ctx: ServiceContext, id: string, raw: unknown): Promise<CouponView> {
  requirePermission(ctx.actor, "marketing.manage");
  const input = couponSchema.parse(raw);
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(coupons).where(eq(coupons.id, id)).for("update");
      if (!before) throw new NotFoundError("Coupon not found.");
      if (before.usedCount > 0 && input.code !== before.code.toUpperCase()) {
        throw new ConflictError("This code has been used, so it can't be renamed. Create a new coupon instead.");
      }
      const [c] = await tx
        .update(coupons)
        .set({ ...input, description: input.description ?? null, updatedAt: new Date() })
        .where(eq(coupons.id, id))
        .returning();
      await writeAudit(tx, ctx, { action: "coupon.update", entityType: "coupon", entityId: id, before, after: input });
      return view(c!);
    });
  } catch (err) {
    if (uniqueViolation(err)) throw new ConflictError("A coupon with this code already exists.");
    throw err;
  }
}
