/**
 * Product reviews (verified buyers only) and moderation.
 * A customer may review a product once they have a delivered order containing
 * it; editing a review sends it back to moderation. Approved reviews drive the
 * product's rating average/count.
 */
import { type DbOrTx, db, orderItems, orders, products, reviews, users } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { reviewInputSchema, reviewModerationSchema } from "@ecom/validation";
import { and, desc, eq, sql } from "drizzle-orm";
import type { CustomerContext } from "./account";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { ConflictError, NotFoundError } from "./errors";
import { notifyStaffWith } from "./notifications";

export interface MyReviewState {
  /** Delivered order item that makes this a verified purchase (null = can't review yet). */
  orderItemId: string | null;
  review: { rating: number; title: string | null; body: string | null; status: "pending" | "approved" | "rejected" } | null;
}

export async function myReviewState(c: CustomerContext, productId: string): Promise<MyReviewState> {
  const [item] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orders.customerId, c.userId), eq(orderItems.productId, productId), sql`${orders.status} in ('delivered','return_requested','returned')`))
    .limit(1);
  const [review] = await db
    .select({ rating: reviews.rating, title: reviews.title, body: reviews.body, status: reviews.status })
    .from(reviews)
    .where(and(eq(reviews.userId, c.userId), eq(reviews.productId, productId)));
  return { orderItemId: item?.id ?? null, review: review ?? null };
}

export async function submitReview(c: CustomerContext, productId: string, raw: unknown) {
  const input = reviewInputSchema.parse(raw);
  const state = await myReviewState(c, productId);
  if (!state.orderItemId) throw new ConflictError("You can review this product once an order containing it has been delivered.");
  const [p] = await db.select({ name: products.name }).from(products).where(eq(products.id, productId));
  if (!p) throw new NotFoundError("Product not found.");
  await db.transaction(async (tx) => {
    await tx
      .insert(reviews)
      .values({ productId, userId: c.userId, orderItemId: state.orderItemId, rating: input.rating, title: input.title || null, body: input.body, status: "pending" })
      .onConflictDoUpdate({
        target: [reviews.userId, reviews.productId],
        set: { rating: input.rating, title: input.title || null, body: input.body, status: "pending", moderatedBy: null, updatedAt: new Date() },
      });
    await recomputeRating(tx, productId);
    await notifyStaffWith(tx, ["reviews.moderate"], { type: "review.pending", title: `New ${input.rating}★ review`, body: p.name, link: "/reviews" }, null);
  });
  return myReviewState(c, productId);
}

/** Rating average/count from approved reviews only. */
export async function recomputeRating(conn: DbOrTx, productId: string) {
  await conn.execute(sql`
    update products p
       set rating_avg = coalesce((select round(avg(rating)::numeric, 2) from reviews r where r.product_id = p.id and r.status = 'approved'), 0),
           rating_count = (select count(*) from reviews r where r.product_id = p.id and r.status = 'approved')
     where p.id = ${productId}`);
}

// ------------------------------------------------------------------ admin

export interface AdminReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: "pending" | "approved" | "rejected";
  verified: boolean;
  createdAt: Date;
  author: string;
  email: string;
  productId: string;
  productName: string;
}

export async function listReviewsAdmin(ctx: ServiceContext, q: { status?: string; page?: string }) {
  requirePermission(ctx.actor, "reviews.moderate");
  const status = ["pending", "approved", "rejected"].includes(q.status ?? "") ? (q.status as AdminReviewRow["status"]) : "pending";
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = 25;
  const where = eq(reviews.status, status);
  const [rows, [total], counts] = await Promise.all([
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        status: reviews.status,
        verified: sql<boolean>`${reviews.orderItemId} is not null`,
        createdAt: reviews.createdAt,
        author: users.name,
        email: users.email,
        productId: products.id,
        productName: products.name,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .innerJoin(products, eq(products.id, reviews.productId))
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(reviews).where(where),
    db.select({ status: reviews.status, n: sql<number>`count(*)::int` }).from(reviews).groupBy(reviews.status),
  ]);
  return {
    items: rows as AdminReviewRow[],
    total: total?.n ?? 0,
    page,
    pageSize,
    status,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<AdminReviewRow["status"], number>>,
  };
}

export async function moderateReview(ctx: ServiceContext, id: string, raw: unknown) {
  requirePermission(ctx.actor, "reviews.moderate");
  const { decision } = reviewModerationSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(reviews).where(eq(reviews.id, id)).for("update");
    if (!r) throw new NotFoundError("Review not found.");
    await tx.update(reviews).set({ status: decision, moderatedBy: ctx.actor.userId, updatedAt: new Date() }).where(eq(reviews.id, id));
    await recomputeRating(tx, r.productId);
    await writeAudit(tx, ctx, { action: `review.${decision}`, entityType: "review", entityId: id, before: { status: r.status }, after: { status: decision } });
    return { id, status: decision };
  });
}
