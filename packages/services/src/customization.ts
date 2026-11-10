/**
 * Customisation engine services.
 *  - Admin: per-product option configuration.
 *  - Customers: designs they own (signed-in customer id OR anonymous guest
 *    token), saved as immutable versions; submitted for review.
 *  - Staff: review workflow (assign designer, approve / request changes, notes)
 *    with assignment-scoped access for designers.
 * Ownership is always derived by the caller from the verified session or the
 * httpOnly guest cookie — never from request bodies.
 */
import {
  categories,
  customerDesigns,
  customizationOptions,
  type DbOrTx,
  db,
  designApprovals,
  designNotes,
  designVersions,
  inventory,
  permissions,
  productImages,
  products,
  productVariants,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@ecom/db";
import { type Actor, can, canAccessAssigned, canAny, requirePermission } from "@ecom/rbac";
import {
  adminDesignListQuery,
  designAssignSchema,
  designNoteSchema,
  designReviewSchema,
  designSaveSchema,
  designUpdateSchema,
  evaluateSelections,
  optionSetSchema,
  type Paginated,
  type SelectionResult,
  type StoredOption,
} from "@ecom/validation";
import { and, asc, count, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "./errors";

const MAX_DESIGNS_PER_OWNER = 50;
const MAX_VERSIONS = 100;
const EDITABLE = ["draft", "changes_requested"] as const;
type DesignStatus = (typeof customerDesigns.$inferSelect)["status"];

// =========================================================== admin options

async function loadOptions(conn: DbOrTx, productId: string, activeOnly: boolean): Promise<(StoredOption & { id: string; helpText: string | null; groupName: string | null; isActive: boolean })[]> {
  const rows = await conn
    .select()
    .from(customizationOptions)
    .where(and(eq(customizationOptions.productId, productId), activeOnly ? eq(customizationOptions.isActive, true) : undefined))
    .orderBy(asc(customizationOptions.sortOrder));
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    helpText: r.helpText,
    groupName: r.groupName,
    type: r.type,
    isRequired: r.isRequired,
    isActive: r.isActive,
    config: (r.config ?? {}) as Record<string, unknown>,
  }));
}

export async function listProductOptions(ctx: ServiceContext, productId: string) {
  requirePermission(ctx.actor, "products.view");
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), isNull(products.deletedAt)));
  if (!p) throw new NotFoundError("Product not found.");
  return loadOptions(db, productId, false);
}

/** Replaces a product's option set (keys are stable identifiers inside saved designs). */
export async function saveProductOptions(ctx: ServiceContext, productId: string, raw: unknown) {
  requirePermission(ctx.actor, "products.update");
  const { options } = optionSetSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .for("update");
    if (!p) throw new NotFoundError("Product not found.");
    const before = await loadOptions(tx, productId, false);

    await tx.delete(customizationOptions).where(eq(customizationOptions.productId, productId));
    if (options.length) {
      await tx.insert(customizationOptions).values(
        options.map((o, i) => ({
          productId,
          key: o.key,
          label: o.label,
          helpText: o.helpText ?? null,
          groupName: o.groupName ?? null,
          type: o.type,
          isRequired: o.isRequired,
          isActive: o.isActive,
          config: o.config,
          sortOrder: i,
        })),
      );
    }
    // A product with active options is customisable; without, it isn't.
    await tx.update(products).set({ isCustomizable: options.some((o) => o.isActive) }).where(eq(products.id, productId));
    await writeAudit(tx, ctx, {
      action: "product.customization.update",
      entityType: "product",
      entityId: productId,
      before: { keys: before.map((o) => o.key) },
      after: { keys: options.map((o) => o.key) },
    });
    return loadOptions(tx, productId, false);
  });
}

// ========================================================= public customizer

export interface CustomizerData {
  product: { id: string; slug: string; name: string; categoryName: string; requiresDesignReview: boolean; imageUrl: string | null };
  variants: { id: string; sku: string; name: string; color: string | null; colorHex: string | null; size: string | null; price: number; compareAtPrice: number | null; isDefault: boolean; inStock: boolean }[];
  options: StoredOption[];
}

async function customizerFor(conn: DbOrTx, productId: string): Promise<CustomizerData | null> {
  const [p] = await conn
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      requiresDesignReview: products.requiresDesignReview,
      categoryName: categories.name,
      imageUrl: sql<string | null>`(select url from ${productImages} i where i.product_id = ${products.id} order by i.sort_order limit 1)`,
    })
    .from(products)
    .innerJoin(categories, and(eq(categories.id, products.categoryId), eq(categories.isActive, true), isNull(categories.deletedAt)))
    .where(and(eq(products.id, productId), eq(products.status, "published"), eq(products.isCustomizable, true), isNull(products.deletedAt)));
  if (!p) return null;
  const options = await loadOptions(conn, productId, true);
  if (options.length === 0) return null;
  const variants = await conn
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      name: productVariants.name,
      color: productVariants.color,
      colorHex: productVariants.colorHex,
      size: productVariants.size,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      isDefault: productVariants.isDefault,
      inStock: sql<boolean>`coalesce(${inventory.onHand} - ${inventory.reserved}, 0) > 0`,
    })
    .from(productVariants)
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(and(eq(productVariants.productId, productId), eq(productVariants.isActive, true), isNull(productVariants.deletedAt)))
    .orderBy(asc(productVariants.sortOrder));
  if (variants.length === 0) return null;
  return {
    product: p,
    variants,
    options: options.map(({ key, label, type, isRequired, config, helpText, groupName }) => ({
      key,
      label,
      type,
      isRequired,
      config: { ...config, helpText, groupName },
    })),
  };
}

/** Data for /customize/[productId]: published, customisable products only. */
export function getCustomizerData(productId: string) {
  return customizerFor(db, productId);
}

// ================================================================ designs

export type DesignOwner = { customerId: string } | { guestToken: string };

function ownerWhere(owner: DesignOwner): SQL {
  return "customerId" in owner
    ? eq(customerDesigns.customerId, owner.customerId)
    : and(eq(customerDesigns.guestToken, owner.guestToken), isNull(customerDesigns.customerId))!;
}

export interface DesignView {
  id: string;
  name: string;
  status: DesignStatus;
  version: number;
  canEdit: boolean;
  product: CustomizerData["product"];
  variant: CustomizerData["variants"][number] | null;
  options: StoredOption[];
  config: { options: Record<string, unknown> };
  pricing: { base: number; customization: number; total: number };
  summary: SelectionResult["summary"];
  missing: Record<string, string>;
  /** Comments from reviewers that the customer may see. */
  feedback: { decision: string; comment: string | null; createdAt: Date }[];
  submittedAt: Date | null;
  approvedAt: Date | null;
  updatedAt: Date;
}

async function buildView(conn: DbOrTx, designId: string, filter?: SQL): Promise<DesignView> {
  const [d] = await conn
    .select()
    .from(customerDesigns)
    .where(and(eq(customerDesigns.id, designId), isNull(customerDesigns.deletedAt), filter));
  if (!d) throw new NotFoundError("Design not found.");
  const [v] = d.currentVersionId
    ? await conn.select().from(designVersions).where(eq(designVersions.id, d.currentVersionId))
    : [];
  // Product may have been unpublished since; load it regardless for viewing.
  const [p] = await conn
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      requiresDesignReview: products.requiresDesignReview,
      categoryName: categories.name,
      imageUrl: sql<string | null>`(select url from ${productImages} i where i.product_id = ${products.id} order by i.sort_order limit 1)`,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, d.productId));
  const options = (await loadOptions(conn, d.productId, false)).map(({ key, label, type, isRequired, config }) => ({ key, label, type, isRequired, config }));
  const variants = await conn
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      name: productVariants.name,
      color: productVariants.color,
      colorHex: productVariants.colorHex,
      size: productVariants.size,
      price: productVariants.price,
      compareAtPrice: productVariants.compareAtPrice,
      isDefault: productVariants.isDefault,
      inStock: sql<boolean>`coalesce(${inventory.onHand} - ${inventory.reserved}, 0) > 0`,
    })
    .from(productVariants)
    .leftJoin(inventory, eq(inventory.variantId, productVariants.id))
    .where(eq(productVariants.productId, d.productId));
  const variant = variants.find((x) => x.id === d.variantId) ?? variants.find((x) => x.isDefault) ?? variants[0] ?? null;
  const config = ((v?.config as { options?: Record<string, unknown> }) ?? {}).options ?? {};
  const evalFull = evaluateSelections(options, config, { requireAll: true });
  const evalDraft = evaluateSelections(options, config, { requireAll: false });
  const feedback = await conn
    .select({ decision: designApprovals.decision, comment: designApprovals.comment, createdAt: designApprovals.createdAt })
    .from(designApprovals)
    .where(and(eq(designApprovals.designId, designId), eq(designApprovals.actorType, "designer")))
    .orderBy(desc(designApprovals.createdAt));
  const base = variant?.price ?? 0;
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    version: v?.version ?? 0,
    canEdit: (EDITABLE as readonly string[]).includes(d.status),
    product: p!,
    variant,
    options,
    config: { options: evalDraft.values },
    pricing: { base, customization: evalDraft.priceDelta, total: base + evalDraft.priceDelta },
    summary: evalDraft.summary,
    missing: evalFull.errors,
    feedback,
    submittedAt: d.submittedAt,
    approvedAt: d.approvedAt,
    updatedAt: d.updatedAt,
  };
}

function selectionErrors(result: SelectionResult): never {
  throw new ValidationError("Some choices need attention.", Object.fromEntries(Object.entries(result.errors).map(([k, v]) => [k, [v]])));
}

export async function createDesign(owner: DesignOwner, raw: unknown): Promise<DesignView> {
  const input = designSaveSchema.parse(raw);
  return db.transaction(async (tx) => {
    const data = await customizerFor(tx, input.productId);
    if (!data) throw new NotFoundError("This product can't be customised.");
    if (input.variantId && !data.variants.some((v) => v.id === input.variantId)) {
      throw new ValidationError("Choose a valid option.", { variantId: ["Unknown variant"] });
    }
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(customerDesigns).where(and(ownerWhere(owner), isNull(customerDesigns.deletedAt)));
    if (n >= MAX_DESIGNS_PER_OWNER) throw new ConflictError(`You can keep up to ${MAX_DESIGNS_PER_OWNER} designs. Delete some to save new ones.`);

    const result = evaluateSelections(data.options, input.config.options, { requireAll: false });
    if (!result.ok) selectionErrors(result);

    const [d] = await tx
      .insert(customerDesigns)
      .values({
        customerId: "customerId" in owner ? owner.customerId : null,
        guestToken: "guestToken" in owner ? owner.guestToken : null,
        productId: input.productId,
        variantId: input.variantId ?? data.variants.find((v) => v.isDefault)?.id ?? data.variants[0]!.id,
        name: input.name,
        status: "draft",
      })
      .returning({ id: customerDesigns.id });
    const [v] = await tx
      .insert(designVersions)
      .values({
        designId: d!.id,
        version: 1,
        config: { options: result.values },
        authorType: "customer",
        authorId: "customerId" in owner ? owner.customerId : null,
      })
      .returning({ id: designVersions.id });
    await tx.update(customerDesigns).set({ currentVersionId: v!.id }).where(eq(customerDesigns.id, d!.id));
    return buildView(tx, d!.id);
  });
}

export async function updateDesign(owner: DesignOwner, designId: string, raw: unknown): Promise<DesignView> {
  const input = designUpdateSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(customerDesigns)
      .where(and(eq(customerDesigns.id, designId), ownerWhere(owner), isNull(customerDesigns.deletedAt)))
      .for("update");
    if (!d) throw new NotFoundError("Design not found.");
    if (!(EDITABLE as readonly string[]).includes(d.status)) {
      throw new ConflictError("This design is with our team now, so it can't be edited. Duplicate it to make a new version.");
    }
    const [cur] = await tx
      .select({ version: designVersions.version })
      .from(designVersions)
      .where(eq(designVersions.id, d.currentVersionId!));
    const current = cur?.version ?? 0;
    if (input.baseVersion !== current) throw new ConflictError("This design changed in another tab. Reload to see the latest version.");
    if (current >= MAX_VERSIONS) throw new ConflictError("This design has too many versions. Duplicate it to continue.");

    const options = await loadOptions(tx, d.productId, true);
    if (input.variantId) {
      const [ok] = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.id, input.variantId), eq(productVariants.productId, d.productId), isNull(productVariants.deletedAt)));
      if (!ok) throw new ValidationError("Choose a valid option.", { variantId: ["Unknown variant"] });
    }
    const result = evaluateSelections(options, input.config.options, { requireAll: false });
    if (!result.ok) selectionErrors(result);

    const [v] = await tx
      .insert(designVersions)
      .values({
        designId,
        version: current + 1,
        config: { options: result.values },
        authorType: "customer",
        authorId: "customerId" in owner ? owner.customerId : null,
      })
      .returning({ id: designVersions.id });
    await tx
      .update(customerDesigns)
      .set({ currentVersionId: v!.id, name: input.name ?? d.name, variantId: input.variantId ?? d.variantId })
      .where(eq(customerDesigns.id, designId));
    return buildView(tx, designId);
  });
}

export function getDesign(owner: DesignOwner, designId: string): Promise<DesignView> {
  return buildView(db, designId, ownerWhere(owner));
}

export async function listMyDesigns(owner: DesignOwner) {
  return db
    .select({
      id: customerDesigns.id,
      name: customerDesigns.name,
      status: customerDesigns.status,
      updatedAt: customerDesigns.updatedAt,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(customerDesigns)
    .innerJoin(products, eq(products.id, customerDesigns.productId))
    .where(and(ownerWhere(owner), isNull(customerDesigns.deletedAt)))
    .orderBy(desc(customerDesigns.updatedAt))
    .limit(MAX_DESIGNS_PER_OWNER);
}

/**
 * Finalise a design. Products that need design review go to the review queue;
 * others are ready immediately.
 */
export async function submitDesign(owner: DesignOwner, designId: string): Promise<DesignView> {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(customerDesigns)
      .where(and(eq(customerDesigns.id, designId), ownerWhere(owner), isNull(customerDesigns.deletedAt)))
      .for("update");
    if (!d) throw new NotFoundError("Design not found.");
    if (!(EDITABLE as readonly string[]).includes(d.status)) throw new ConflictError("This design has already been submitted.");
    const data = await customizerFor(tx, d.productId);
    if (!data) throw new ConflictError("This product is no longer available for customisation.");
    const [v] = await tx.select().from(designVersions).where(eq(designVersions.id, d.currentVersionId!));
    const result = evaluateSelections(data.options, ((v?.config as { options?: Record<string, unknown> }) ?? {}).options ?? {}, { requireAll: true });
    if (!result.ok) selectionErrors(result);

    const now = new Date();
    if (data.product.requiresDesignReview) {
      await tx.update(customerDesigns).set({ status: "submitted", submittedAt: now }).where(eq(customerDesigns.id, designId));
    } else {
      await tx.update(customerDesigns).set({ status: "approved", submittedAt: now, approvedAt: now }).where(eq(customerDesigns.id, designId));
      await tx.insert(designApprovals).values({
        designId,
        versionId: v!.id,
        actorType: "customer",
        actorId: "customerId" in owner ? owner.customerId : null,
        decision: "approved",
        comment: "Ready to order (this product doesn't need design review).",
      });
    }
    return buildView(tx, designId);
  });
}

/** Copy a design's current version into a new editable draft (e.g. after approval). */
export async function duplicateDesign(owner: DesignOwner, designId: string): Promise<DesignView> {
  const src = await getDesign(owner, designId);
  return createDesign(owner, {
    productId: src.product.id,
    variantId: src.variant?.id,
    name: `${src.name} (copy)`.slice(0, 80),
    config: src.config,
  });
}

export async function deleteDesign(owner: DesignOwner, designId: string): Promise<void> {
  const res = await db
    .update(customerDesigns)
    .set({ deletedAt: new Date() })
    .where(and(eq(customerDesigns.id, designId), ownerWhere(owner), isNull(customerDesigns.deletedAt), inArray(customerDesigns.status, [...EDITABLE])))
    .returning({ id: customerDesigns.id });
  if (res.length === 0) throw new NotFoundError("Design not found, or it's already with our team.");
}

/** On sign-in: move a guest's designs to their account (Phase 5 calls this). */
export async function claimGuestDesigns(customerId: string, guestToken: string): Promise<number> {
  const res = await db
    .update(customerDesigns)
    .set({ customerId, guestToken: null })
    .where(and(eq(customerDesigns.guestToken, guestToken), isNull(customerDesigns.customerId)))
    .returning({ id: customerDesigns.id });
  return res.length;
}

// ====================================================== staff: design review

const canSeeAll = (a: Actor) => can(a, "designs.view");

function assertDesignAccess(ctx: ServiceContext, assignedDesignerId: string | null) {
  // Not visible → 404 (no confirmation that the design exists).
  if (!canAccessAssigned(ctx.actor, "designs.view", "designs.view_assigned", assignedDesignerId)) {
    throw new NotFoundError("Design not found.");
  }
}

export interface AdminDesignListItem {
  id: string;
  name: string;
  status: DesignStatus;
  productName: string;
  customerName: string;
  designerName: string | null;
  submittedAt: Date | null;
  updatedAt: Date;
}

export async function listDesignsAdmin(ctx: ServiceContext, raw: unknown): Promise<Paginated<AdminDesignListItem>> {
  if (!canAny(ctx.actor, ["designs.view", "designs.view_assigned"])) throw new AuthorizationError();
  const q = adminDesignListQuery.parse(raw);
  // Drafts are the customer's private work in progress: never listed for staff.
  const filters: SQL[] = [isNull(customerDesigns.deletedAt), ne(customerDesigns.status, "draft")];
  // Designers without the global permission only ever see their own assignments.
  if (!canSeeAll(ctx.actor) || q.mine) filters.push(eq(customerDesigns.assignedDesignerId, ctx.actor.userId));
  if (q.status) filters.push(eq(customerDesigns.status, q.status));
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: customerDesigns.id,
        name: customerDesigns.name,
        status: customerDesigns.status,
        productName: products.name,
        customerName: sql<string>`coalesce((select split_part(u.name, ' ', 1) from ${users} u where u.id = ${customerDesigns.customerId}), 'Guest')`,
        designerName: sql<string | null>`(select u.name from ${users} u where u.id = ${customerDesigns.assignedDesignerId})`,
        submittedAt: customerDesigns.submittedAt,
        updatedAt: customerDesigns.updatedAt,
      })
      .from(customerDesigns)
      .innerJoin(products, eq(products.id, customerDesigns.productId))
      .where(where)
      .orderBy(sql`${customerDesigns.submittedAt} desc nulls last`)
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(customerDesigns).where(where),
  ]);
  const total = totalRow?.n ?? 0;
  return { items: rows, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export interface AdminDesignDetail extends DesignView {
  customer: { name: string; email: string | null } | null;
  assignedDesigner: { id: string; name: string } | null;
  versions: { version: number; authorType: string; createdAt: Date }[];
  history: { decision: string; comment: string | null; actorName: string | null; actorType: string; createdAt: Date }[];
  notes: { id: string; body: string; authorName: string | null; createdAt: Date }[];
}

export async function getDesignAdmin(ctx: ServiceContext, designId: string): Promise<AdminDesignDetail> {
  if (!canAny(ctx.actor, ["designs.view", "designs.view_assigned"])) throw new AuthorizationError();
  const [d] = await db
    .select({ assigned: customerDesigns.assignedDesignerId, customerId: customerDesigns.customerId, status: customerDesigns.status })
    .from(customerDesigns)
    .where(and(eq(customerDesigns.id, designId), isNull(customerDesigns.deletedAt)));
  if (!d || d.status === "draft") throw new NotFoundError("Design not found.");
  assertDesignAccess(ctx, d.assigned);

  const view = await buildView(db, designId);
  const [customer] = d.customerId ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, d.customerId)) : [];
  const [designer] = d.assigned ? await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, d.assigned)) : [];
  const [versions, history, notes] = await Promise.all([
    db
      .select({ version: designVersions.version, authorType: designVersions.authorType, createdAt: designVersions.createdAt })
      .from(designVersions)
      .where(eq(designVersions.designId, designId))
      .orderBy(desc(designVersions.version)),
    db
      .select({
        decision: designApprovals.decision,
        comment: designApprovals.comment,
        actorType: designApprovals.actorType,
        actorName: users.name,
        createdAt: designApprovals.createdAt,
      })
      .from(designApprovals)
      .leftJoin(users, eq(users.id, designApprovals.actorId))
      .where(eq(designApprovals.designId, designId))
      .orderBy(desc(designApprovals.createdAt)),
    db
      .select({ id: designNotes.id, body: designNotes.body, authorName: users.name, createdAt: designNotes.createdAt })
      .from(designNotes)
      .leftJoin(users, eq(users.id, designNotes.authorId))
      .where(eq(designNotes.designId, designId))
      .orderBy(desc(designNotes.createdAt)),
  ]);
  return {
    ...view,
    // Email only for staff who may view customer records (data minimisation for designers).
    customer: customer ? { name: customer.name, email: can(ctx.actor, "customers.view") ? customer.email : null } : null,
    assignedDesigner: designer ?? null,
    versions,
    history,
    notes,
  };
}

/** Active staff whose roles let them work on designs. */
export async function listDesigners(ctx: ServiceContext) {
  requirePermission(ctx.actor, "designs.assign");
  return db
    .selectDistinct({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(users.status, "active"),
        isNull(users.deletedAt),
        sql`(${permissions.key} in ('designs.view', 'designs.view_assigned') or ${roles.key} = 'super_admin')`,
      ),
    )
    .orderBy(asc(users.name));
}

export async function assignDesigner(ctx: ServiceContext, designId: string, raw: unknown) {
  requirePermission(ctx.actor, "designs.assign");
  const { designerId } = designAssignSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(customerDesigns).where(and(eq(customerDesigns.id, designId), isNull(customerDesigns.deletedAt))).for("update");
    if (!d || d.status === "draft") throw new NotFoundError("Design not found.");
    if (["approved", "rejected"].includes(d.status)) throw new ConflictError("This design is already closed.");
    if (designerId) {
      const eligible = (await listDesigners(ctx)).some((u) => u.id === designerId);
      if (!eligible) throw new ValidationError("That person can't work on designs.", { designerId: ["Not a designer"] });
    }
    const status: DesignStatus = designerId ? (d.status === "submitted" ? "in_review" : d.status) : d.status === "in_review" ? "submitted" : d.status;
    await tx
      .update(customerDesigns)
      .set({ assignedDesignerId: designerId, assignedAt: designerId ? new Date() : null, status })
      .where(eq(customerDesigns.id, designId));
    await writeAudit(tx, ctx, {
      action: "design.assign",
      entityType: "design",
      entityId: designId,
      before: { designerId: d.assignedDesignerId, status: d.status },
      after: { designerId, status },
    });
    return { id: designId, status, assignedDesignerId: designerId };
  });
}

export async function reviewDesign(ctx: ServiceContext, designId: string, raw: unknown) {
  requirePermission(ctx.actor, "designs.approve");
  const { decision, comment } = designReviewSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(customerDesigns).where(and(eq(customerDesigns.id, designId), isNull(customerDesigns.deletedAt))).for("update");
    if (!d || d.status === "draft") throw new NotFoundError("Design not found.");
    assertDesignAccess(ctx, d.assignedDesignerId);
    if (!["submitted", "in_review"].includes(d.status)) throw new ConflictError("Only submitted designs can be reviewed.");
    const status: DesignStatus = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "changes_requested";
    await tx
      .update(customerDesigns)
      .set({ status, approvedAt: decision === "approved" ? new Date() : null })
      .where(eq(customerDesigns.id, designId));
    await tx.insert(designApprovals).values({
      designId,
      versionId: d.currentVersionId!,
      actorId: ctx.actor.userId,
      actorType: "designer",
      decision,
      comment: comment ?? null,
    });
    await writeAudit(tx, ctx, {
      action: `design.${decision}`,
      entityType: "design",
      entityId: designId,
      before: { status: d.status },
      after: { status, comment: comment ?? null },
    });
    return { id: designId, status };
  });
}

export async function addDesignNote(ctx: ServiceContext, designId: string, raw: unknown) {
  if (!canAny(ctx.actor, ["designs.update", "designs.approve"])) throw new AuthorizationError();
  const { body } = designNoteSchema.parse(raw);
  const [d] = await db
    .select({ assigned: customerDesigns.assignedDesignerId, status: customerDesigns.status })
    .from(customerDesigns)
    .where(and(eq(customerDesigns.id, designId), isNull(customerDesigns.deletedAt)));
  if (!d || d.status === "draft") throw new NotFoundError("Design not found.");
  assertDesignAccess(ctx, d.assigned);
  const [note] = await db.insert(designNotes).values({ designId, authorId: ctx.actor.userId, body }).returning();
  return note!;
}
