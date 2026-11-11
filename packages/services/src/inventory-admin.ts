/**
 * Inventory for staff: stock levels, the movement ledger, minimum-stock
 * alerts, suppliers, and purchases. Receiving a purchase adds stock through
 * the same ledger as everything else. inventory.view reads; inventory.manage writes.
 */
import { db, inventory, inventoryMovements, products, productVariants, purchaseItems, purchases, suppliers, users } from "@ecom/db";
import { requirePermission } from "@ecom/rbac";
import { minStockSchema, type Paginated, purchaseActionSchema, purchaseSchema, stockListQuery, supplierSchema } from "@ecom/validation";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { writeAudit } from "./audit";
import type { ServiceContext } from "./context";
import { ConflictError, NotFoundError, uniqueViolation, ValidationError } from "./errors";

// ---------------------------------------------------------------- stock

export interface StockRow {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  minStock: number;
  low: boolean;
}

export async function listStock(ctx: ServiceContext, raw: unknown): Promise<Paginated<StockRow>> {
  requirePermission(ctx.actor, "inventory.view");
  const q = stockListQuery.parse(raw);
  const f: (SQL | undefined)[] = [isNull(productVariants.deletedAt), isNull(products.deletedAt)];
  if (q.q) {
    const t = `%${q.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    f.push(or(ilike(products.name, t), ilike(productVariants.sku, t), ilike(productVariants.name, t)));
  }
  if (q.low) f.push(sql`${inventory.onHand} - ${inventory.reserved} <= ${inventory.minStock}`);
  const where = and(...f);
  const [rows, [t]] = await Promise.all([
    db
      .select({
        variantId: productVariants.id,
        productId: products.id,
        productName: products.name,
        variantName: productVariants.name,
        sku: productVariants.sku,
        onHand: inventory.onHand,
        reserved: inventory.reserved,
        minStock: inventory.minStock,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(inventory, eq(inventory.variantId, productVariants.id))
      .where(where)
      .orderBy(sql`${inventory.onHand} - ${inventory.reserved} - ${inventory.minStock} asc`, asc(products.name))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: count() }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId)).innerJoin(inventory, eq(inventory.variantId, productVariants.id)).where(where),
  ]);
  const total = t?.n ?? 0;
  return {
    items: rows.map((r) => ({ ...r, available: r.onHand - r.reserved, low: r.onHand - r.reserved <= r.minStock })),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export async function listMovements(ctx: ServiceContext, variantId: string) {
  requirePermission(ctx.actor, "inventory.view");
  return db
    .select({
      id: inventoryMovements.id,
      type: inventoryMovements.type,
      onHandDelta: inventoryMovements.onHandDelta,
      reservedDelta: inventoryMovements.reservedDelta,
      referenceType: inventoryMovements.referenceType,
      referenceId: inventoryMovements.referenceId,
      note: inventoryMovements.note,
      actor: users.name,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .leftJoin(users, eq(users.id, inventoryMovements.actorId))
    .where(eq(inventoryMovements.variantId, variantId))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(200);
}

export async function setMinStock(ctx: ServiceContext, variantId: string, raw: unknown) {
  requirePermission(ctx.actor, "inventory.manage");
  const { minStock } = minStockSchema.parse(raw);
  const res = await db.update(inventory).set({ minStock, updatedAt: new Date() }).where(eq(inventory.variantId, variantId)).returning({ variantId: inventory.variantId });
  if (!res.length) throw new NotFoundError("Variant not found.");
  await writeAudit(db, ctx, { action: "inventory.min_stock", entityType: "variant", entityId: variantId, after: { minStock } });
  return { variantId, minStock };
}

// ------------------------------------------------------------- suppliers

export async function listSuppliers(ctx: ServiceContext) {
  requirePermission(ctx.actor, "inventory.view");
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contactName: suppliers.contactName,
      email: suppliers.email,
      phone: suppliers.phone,
      gstin: suppliers.gstin,
      address: suppliers.address,
      notes: suppliers.notes,
      isActive: suppliers.isActive,
      purchaseCount: sql<number>`(select count(*)::int from ${purchases} p where p.supplier_id = "suppliers"."id")`,
    })
    .from(suppliers)
    .where(isNull(suppliers.deletedAt))
    .orderBy(asc(suppliers.name));
}

export async function saveSupplier(ctx: ServiceContext, id: string | null, raw: unknown) {
  requirePermission(ctx.actor, "inventory.manage");
  const input = supplierSchema.parse(raw);
  const values = { ...input, contactName: input.contactName ?? null, email: input.email ?? null, phone: input.phone ?? null, gstin: input.gstin ?? null, address: input.address ?? null, notes: input.notes ?? null };
  return db.transaction(async (tx) => {
    let row;
    if (id) {
      [row] = await tx.update(suppliers).set({ ...values, updatedAt: new Date() }).where(and(eq(suppliers.id, id), isNull(suppliers.deletedAt))).returning();
      if (!row) throw new NotFoundError("Supplier not found.");
    } else {
      [row] = await tx.insert(suppliers).values(values).returning();
    }
    await writeAudit(tx, ctx, { action: id ? "supplier.update" : "supplier.create", entityType: "supplier", entityId: row!.id, after: input });
    return row!;
  });
}

// ------------------------------------------------------------- purchases

export async function listPurchases(ctx: ServiceContext) {
  requirePermission(ctx.actor, "inventory.view");
  return db
    .select({
      id: purchases.id,
      reference: purchases.reference,
      status: purchases.status,
      totalCost: purchases.totalCost,
      supplierName: suppliers.name,
      itemCount: sql<number>`(select coalesce(sum(quantity), 0)::int from ${purchaseItems} i where i.purchase_id = "purchases"."id")`,
      orderedAt: purchases.orderedAt,
      receivedAt: purchases.receivedAt,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .orderBy(desc(purchases.createdAt))
    .limit(200);
}

export async function getPurchase(ctx: ServiceContext, id: string) {
  requirePermission(ctx.actor, "inventory.view");
  const [p] = await db.select({ p: purchases, supplierName: suppliers.name }).from(purchases).innerJoin(suppliers, eq(suppliers.id, purchases.supplierId)).where(eq(purchases.id, id));
  if (!p) throw new NotFoundError("Purchase not found.");
  const items = await db
    .select({ id: purchaseItems.id, variantId: purchaseItems.variantId, quantity: purchaseItems.quantity, unitCost: purchaseItems.unitCost, sku: productVariants.sku, variantName: productVariants.name, productName: products.name })
    .from(purchaseItems)
    .innerJoin(productVariants, eq(productVariants.id, purchaseItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(purchaseItems.purchaseId, id));
  return { ...p.p, supplierName: p.supplierName, items };
}

export async function createPurchase(ctx: ServiceContext, raw: unknown) {
  requirePermission(ctx.actor, "inventory.manage");
  const input = purchaseSchema.parse(raw);
  return db.transaction(async (tx) => {
    const [s] = await tx.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.supplierId), isNull(suppliers.deletedAt)));
    if (!s) throw new ValidationError("Choose a supplier.", { supplierId: ["Unknown supplier"] });
    const ids = [...new Set(input.items.map((i) => i.variantId))];
    const found = await tx.select({ id: productVariants.id }).from(productVariants).where(and(inArray(productVariants.id, ids), isNull(productVariants.deletedAt)));
    if (found.length !== ids.length) throw new ValidationError("Some items no longer exist.", { items: ["Unknown item"] });
    const reference = input.reference ?? `PO-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const totalCost = input.items.reduce((a, i) => a + i.quantity * i.unitCost, 0);
    try {
      const [p] = await tx.insert(purchases).values({ supplierId: input.supplierId, reference, notes: input.notes ?? null, totalCost, createdBy: ctx.actor.userId }).returning();
      await tx.insert(purchaseItems).values(input.items.map((i) => ({ purchaseId: p!.id, ...i })));
      await writeAudit(tx, ctx, { action: "purchase.create", entityType: "purchase", entityId: p!.id, after: { reference, totalCost, items: input.items.length } });
      return p!;
    } catch (err) {
      if (uniqueViolation(err)) throw new ConflictError("That purchase reference is already used.");
      throw err;
    }
  });
}

/** draft → ordered → received (adds stock), or cancel before receiving. */
export async function actOnPurchase(ctx: ServiceContext, id: string, raw: unknown) {
  requirePermission(ctx.actor, "inventory.manage");
  const { action } = purchaseActionSchema.parse(raw);
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(purchases).where(eq(purchases.id, id)).for("update");
    if (!p) throw new NotFoundError("Purchase not found.");
    const now = new Date();
    if (action === "order") {
      if (p.status !== "draft") throw new ConflictError("Only drafts can be marked as ordered.");
      await tx.update(purchases).set({ status: "ordered", orderedAt: now, updatedAt: now }).where(eq(purchases.id, id));
    } else if (action === "cancel") {
      if (!["draft", "ordered"].includes(p.status)) throw new ConflictError("Received or cancelled purchases can't be cancelled.");
      await tx.update(purchases).set({ status: "cancelled", updatedAt: now }).where(eq(purchases.id, id));
    } else {
      if (!["draft", "ordered"].includes(p.status)) throw new ConflictError("This purchase was already received or cancelled.");
      const items = await tx.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id));
      for (const i of items) {
        await tx
          .insert(inventory)
          .values({ variantId: i.variantId, onHand: i.quantity })
          .onConflictDoUpdate({ target: inventory.variantId, set: { onHand: sql`${inventory.onHand} + ${i.quantity}`, updatedAt: now } });
        await tx.insert(inventoryMovements).values({ variantId: i.variantId, type: "purchase", onHandDelta: i.quantity, referenceType: "purchase", referenceId: id, note: p.reference, actorId: ctx.actor.userId });
      }
      await tx.update(purchases).set({ status: "received", receivedAt: now, orderedAt: p.orderedAt ?? now, updatedAt: now }).where(eq(purchases.id, id));
    }
    await writeAudit(tx, ctx, { action: `purchase.${action}`, entityType: "purchase", entityId: id, before: { status: p.status } });
  });
  // Read after commit (getPurchase uses its own connection).
  return getPurchase(ctx, id);
}
