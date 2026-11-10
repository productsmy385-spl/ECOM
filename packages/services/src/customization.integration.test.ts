/**
 * Customisation engine against the real test DB: option configuration,
 * design ownership isolation (guest / customer), immutable versions, submit
 * rules, assignment-scoped staff access, review workflow, audit, claim.
 */
import { loadActor } from "@ecom/auth";
import {
  auditLogs,
  categories,
  customerDesigns,
  db,
  designVersions,
  inventory,
  products,
  productVariants,
  roles,
  userRoles,
  users,
} from "@ecom/db";
import { type Actor, AuthorizationError } from "@ecom/rbac";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignDesigner,
  claimGuestDesigns,
  ConflictError,
  createDesign,
  duplicateDesign,
  getCustomizerData,
  getDesign,
  getDesignAdmin,
  listDesignsAdmin,
  listMyDesigns,
  NotFoundError,
  reviewDesign,
  saveProductOptions,
  submitDesign,
  updateDesign,
  ValidationError,
} from "./index";

const run = `z${Date.now().toString(36)}`;
const ctxOf = async (id: string) => ({ actor: (await loadActor(id)) as Actor });
const guestA = { guestToken: `${run}-guest-a`.padEnd(40, "a") };
const guestB = { guestToken: `${run}-guest-b`.padEnd(40, "b") };

let root: string, manager: string, designer: string, otherDesigner: string, staff: string, customer: string;
let reviewProduct: string, plainProduct: string;

async function user(name: string, roleKey?: string) {
  const [u] = await db.insert(users).values({ name: `${name} Test`, email: `${name}.${run}@example.test`, isStaff: !!roleKey }).returning({ id: users.id });
  if (roleKey) {
    const [r] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, roleKey));
    await db.insert(userRoles).values({ userId: u!.id, roleId: r!.id });
  }
  return u!.id;
}

async function product(name: string, review: boolean) {
  const [cat] = await db.insert(categories).values({ name: `Cat ${name} ${run}`, slug: `cat-${name}-${run}`.toLowerCase(), isCustomizable: true }).returning({ id: categories.id });
  const [p] = await db
    .insert(products)
    .values({ name: `${name} ${run}`, slug: `${name}-${run}`.toLowerCase(), categoryId: cat!.id, status: "published", publishedAt: new Date(), requiresDesignReview: review })
    .returning({ id: products.id });
  const [v] = await db.insert(productVariants).values({ productId: p!.id, sku: `${run}-${name}`.toUpperCase(), name: "Std", price: 100000, isDefault: true }).returning({ id: productVariants.id });
  await db.insert(inventory).values({ variantId: v!.id, onHand: 10 });
  return { productId: p!.id, variantId: v!.id };
}

const OPTIONS = {
  options: [
    { key: "shade", label: "Shade", type: "color", isRequired: true, config: { choices: [{ value: "crimson", label: "Crimson", hex: "#CF0F47", priceDelta: 5000 }, { value: "nude", label: "Nude", hex: "#C99A8B" }] } },
    { key: "name_text", label: "Name on case", type: "text", config: { maxLength: 12, priceDelta: 10000 } },
    { key: "label", label: "Label", type: "canvas", config: { maxLayers: 3, fonts: ["sora", "dancing"], priceDelta: 20000 } },
  ],
};
const layer = { id: "layer-1", type: "text", text: "Rosa", x: 0.5, y: 0.5, font: "dancing", size: 0.12, color: "#000000" };

beforeAll(async () => {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  root = r!.id;
  manager = await user("mgr", "manager");
  designer = await user("des", "designer");
  otherDesigner = await user("des2", "designer");
  staff = await user("stf", "staff");
  customer = await user("cus");
  const a = await product("LipCase", true);
  reviewProduct = a.productId;
  plainProduct = (await product("Gloss", false)).productId;
});

afterAll(async () => {
  const prods = await db.select({ id: products.id }).from(products).where(like(products.name, `% ${run}`));
  if (prods.length) {
    await db.delete(customerDesigns).where(inArray(customerDesigns.productId, prods.map((p) => p.id)));
    await db.delete(products).where(inArray(products.id, prods.map((p) => p.id)));
  }
  await db.delete(categories).where(like(categories.name, `% ${run}`));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
});

describe("option configuration", () => {
  it("needs products.update, makes the product customisable and is audited", async () => {
    await expect(saveProductOptions(await ctxOf(manager), reviewProduct, OPTIONS)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await getCustomizerData(reviewProduct)).toBeNull(); // no options yet

    const saved = await saveProductOptions(await ctxOf(root), reviewProduct, OPTIONS);
    expect(saved.map((o) => o.key)).toEqual(["shade", "name_text", "label"]);
    await saveProductOptions(await ctxOf(root), plainProduct, { options: [OPTIONS.options[0]] });
    const [p] = await db.select({ c: products.isCustomizable }).from(products).where(eq(products.id, reviewProduct));
    expect(p?.c).toBe(true);
    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "product.customization.update"), eq(auditLogs.entityId, reviewProduct)));
    expect(log).toBeDefined();

    const data = await getCustomizerData(reviewProduct);
    expect(data?.options).toHaveLength(3);
    expect(data?.variants[0]?.price).toBe(100000);
  });

  it("rejects invalid option sets", async () => {
    await expect(
      saveProductOptions(await ctxOf(root), reviewProduct, { options: [{ key: "x", label: "X", type: "color", config: { choices: [{ value: "a", label: "A" }] } }] }),
    ).rejects.toMatchObject({ name: "ZodError" });
  });
});

describe("designs: ownership and versions", () => {
  let id: string;

  it("a guest can save an incomplete draft; prices are computed server-side", async () => {
    const d = await createDesign(guestA, { productId: reviewProduct, name: "Gift", config: { options: { name_text: "Asha", priceDelta: 999999 } } });
    id = d.id;
    expect(d.status).toBe("draft");
    expect(d.version).toBe(1);
    expect(d.pricing).toEqual({ base: 100000, customization: 10000, total: 110000 });
    expect(d.config.options).not.toHaveProperty("priceDelta"); // unknown keys dropped
    expect(d.missing.shade).toMatch(/required/);
  });

  it("other guests and customers get 404 (not 403) for someone else's design", async () => {
    await expect(getDesign(guestB, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getDesign({ customerId: customer }, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateDesign(guestB, id, { config: { options: {} }, baseVersion: 1 })).rejects.toBeInstanceOf(NotFoundError);
    expect((await listMyDesigns(guestB)).map((d) => d.id)).not.toContain(id);
  });

  it("invalid values are rejected even in drafts", async () => {
    await expect(
      updateDesign(guestA, id, { config: { options: { label: { layers: [{ ...layer, font: "bebas" }] } } }, baseVersion: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("each save is a new immutable version; stale edits are refused", async () => {
    const v2 = await updateDesign(guestA, id, { config: { options: { shade: "crimson", name_text: "Asha", label: { layers: [layer] } } }, baseVersion: 1 });
    expect(v2.version).toBe(2);
    expect(v2.pricing.total).toBe(100000 + 5000 + 10000 + 20000);
    await expect(updateDesign(guestA, id, { config: { options: {} }, baseVersion: 1 })).rejects.toBeInstanceOf(ConflictError);
    const versions = await db.select().from(designVersions).where(eq(designVersions.designId, id));
    expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);
    expect((versions.find((v) => v.version === 1)!.config as { options: Record<string, unknown> }).options).toEqual({ name_text: "Asha" });
  });

  it("submitting needs every required option, then locks editing", async () => {
    const incomplete = await createDesign(guestA, { productId: reviewProduct, config: { options: {} } });
    await expect(submitDesign(guestA, incomplete.id)).rejects.toBeInstanceOf(ValidationError);
    const s = await submitDesign(guestA, id);
    expect(s.status).toBe("submitted");
    await expect(updateDesign(guestA, id, { config: { options: {} }, baseVersion: 2 })).rejects.toBeInstanceOf(ConflictError);
  });

  it("products without review are ready immediately on submit", async () => {
    const d = await createDesign(guestA, { productId: plainProduct, config: { options: { shade: "nude" } } });
    expect((await submitDesign(guestA, d.id)).status).toBe("approved");
  });

  describe("staff review", () => {
    it("drafts are invisible to staff; designers only see their assignments", async () => {
      const mgrList = await listDesignsAdmin(await ctxOf(manager), {});
      expect(mgrList.items.map((i) => i.id)).toContain(id);
      expect(mgrList.items.every((i) => i.status !== "draft")).toBe(true);

      expect((await listDesignsAdmin(await ctxOf(designer), {})).items.map((i) => i.id)).not.toContain(id);
      await expect(getDesignAdmin(await ctxOf(designer), id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(listDesignsAdmin(await ctxOf(staff), {})).rejects.toBeInstanceOf(AuthorizationError);
    });

    it("only eligible designers can be assigned; assignment starts the review", async () => {
      const ctx = await ctxOf(manager);
      await expect(assignDesigner(ctx, id, { designerId: staff })).rejects.toBeInstanceOf(ValidationError);
      await expect(assignDesigner(await ctxOf(designer), id, { designerId: designer })).rejects.toBeInstanceOf(AuthorizationError);
      const a = await assignDesigner(ctx, id, { designerId: designer });
      expect(a.status).toBe("in_review");

      const detail = await getDesignAdmin(await ctxOf(designer), id);
      expect(detail.assignedDesigner?.id).toBe(designer);
      expect(detail.customer).toBeNull(); // guest design
      await expect(getDesignAdmin(await ctxOf(otherDesigner), id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("designers can't approve; changes need a reason; customers see feedback and can resubmit", async () => {
      await expect(reviewDesign(await ctxOf(designer), id, { decision: "approved" })).rejects.toBeInstanceOf(AuthorizationError);
      const mctx = await ctxOf(manager);
      await expect(reviewDesign(mctx, id, { decision: "changes_requested" })).rejects.toMatchObject({ name: "ZodError" });
      await reviewDesign(mctx, id, { decision: "changes_requested", comment: "Make the name larger please" });

      const mine = await getDesign(guestA, id);
      expect(mine.status).toBe("changes_requested");
      expect(mine.canEdit).toBe(true);
      expect(mine.feedback[0]?.comment).toBe("Make the name larger please");

      await updateDesign(guestA, id, { config: { options: { shade: "crimson", label: { layers: [{ ...layer, size: 0.2 }] } } }, baseVersion: 2 });
      expect((await submitDesign(guestA, id)).status).toBe("submitted");
      const approved = await reviewDesign(mctx, id, { decision: "approved", comment: "Looks great" });
      expect(approved.status).toBe("approved");
      const logs = await db.select({ a: auditLogs.action }).from(auditLogs).where(eq(auditLogs.entityId, id));
      expect(logs.map((l) => l.a)).toEqual(expect.arrayContaining(["design.assign", "design.changes_requested", "design.approved"]));
    });

    it("approved designs are locked but can be duplicated into a new draft", async () => {
      await expect(updateDesign(guestA, id, { config: { options: {} }, baseVersion: 3 })).rejects.toBeInstanceOf(ConflictError);
      const copy = await duplicateDesign(guestA, id);
      expect(copy.status).toBe("draft");
      expect(copy.id).not.toBe(id);
      expect(copy.config.options.shade).toBe("crimson");
    });
  });

  it("guest designs move to the customer's account on claim", async () => {
    const moved = await claimGuestDesigns(customer, guestA.guestToken);
    expect(moved).toBeGreaterThanOrEqual(3);
    await expect(getDesign(guestA, id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getDesign({ customerId: customer }, id)).id).toBe(id);
  });
});
