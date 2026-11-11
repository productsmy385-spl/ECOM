/**
 * Phase 9: reports and exports against the real test DB. Every report's SQL
 * runs; a placed order shows up in sales/products/customers/inventory; module
 * permissions narrow which reports a role sees; exports need reports.export;
 * CSV/XLSX writers produce valid, injection-safe files.
 */
import { randomUUID } from "node:crypto";
import { loadActor } from "@ecom/auth";
import { categories, db, inventory, inventoryMovements, orders, payments, products, productVariants, roles, userRoles, users } from "@ecom/db";
import { type Actor, AuthorizationError } from "@ecom/rbac";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addToCart, listReports, placeOrder, REPORT_KEYS, resolveRange, runReport, updateCheckoutSettings, ValidationError } from "./index";
import { crc32, reportToCsv, reportToXlsx } from "./report-export";
import type { ReportResult } from "./reports";
import { getCheckoutSettings } from "./settings";

const run = `rp${Date.now().toString(36)}`;
const ctxOf = async (id: string) => ({ actor: (await loadActor(id)) as Actor });
const address = { fullName: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" };
const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

let root: string, invManager: string, manager: string, finance: string;
let customer: { userId: string; email: string; name: string };
let variantId: string, sku: string;
let settingsBefore: Awaited<ReturnType<typeof getCheckoutSettings>>;

async function staff(name: string, role: string) {
  const [u] = await db.insert(users).values({ name, email: `${name.toLowerCase()}.${run}@example.test`, isStaff: true }).returning();
  const [r] = await db.select().from(roles).where(eq(roles.key, role));
  await db.insert(userRoles).values({ userId: u!.id, roleId: r!.id });
  return u!.id;
}

beforeAll(async () => {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, "root@test.local"));
  root = r!.id;
  invManager = await staff("Inv", "inventory_manager");
  manager = await staff("Mgr", "manager");
  finance = await staff("Fin", "finance_manager");
  const [c] = await db.insert(users).values({ name: `Buyer ${run}`, email: `buyer.${run}@example.test` }).returning();
  customer = { userId: c!.id, email: c!.email, name: c!.name };
  const [cat] = await db.insert(categories).values({ name: `Cat ${run}`, slug: `cat-${run}` }).returning();
  const [p] = await db.insert(products).values({ name: `Frame ${run}`, slug: `frame-${run}`, categoryId: cat!.id, status: "published", publishedAt: new Date() }).returning();
  sku = `${run}-R`.toUpperCase();
  const [v] = await db.insert(productVariants).values({ productId: p!.id, sku, name: "8x10", price: 75_000, isDefault: true }).returning();
  await db.insert(inventory).values({ variantId: v!.id, onHand: 10 });
  variantId = v!.id;
  settingsBefore = await getCheckoutSettings();
  await updateCheckoutSettings(await ctxOf(root), { ...settingsBefore, codEnabled: true, codMaxAmount: 10_000_000 });
  const me = { customerId: customer.userId };
  await addToCart(me, { variantId, quantity: 2 });
  await placeOrder(me, { idempotencyKey: randomUUID(), address, paymentMethod: "cod" }, { customer, gateway: null });
});

afterAll(async () => {
  await updateCheckoutSettings(await ctxOf(root), settingsBefore);
  const ords = await db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, customer.userId));
  if (ords.length) {
    await db.delete(payments).where(inArray(payments.orderId, ords.map((o) => o.id)));
    await db.delete(orders).where(inArray(orders.id, ords.map((o) => o.id)));
  }
  await db.delete(inventoryMovements).where(eq(inventoryMovements.variantId, variantId));
  await db.delete(products).where(like(products.name, `% ${run}`));
  await db.delete(categories).where(like(categories.name, `% ${run}`));
  await db.delete(users).where(like(users.email, `%.${run}@example.test`));
});

describe("reports", () => {
  it("every report runs for a super admin", async () => {
    const ctx = await ctxOf(root);
    for (const key of REPORT_KEYS) {
      const r = await runReport(ctx, key, { from: today, to: today, export: true });
      expect(r.key).toBe(key);
      expect(r.columns.length).toBeGreaterThan(0);
    }
  });

  it("a placed order appears in sales, products, customers and inventory", async () => {
    const ctx = await ctxOf(root);
    const sales = await runReport(ctx, "sales", { from: today, to: today });
    expect(sales.rows).toHaveLength(1);
    expect(Number(sales.rows[0]!.orders)).toBeGreaterThanOrEqual(1);
    expect(Number(sales.totals!.units)).toBeGreaterThanOrEqual(2);

    const prod = await runReport(ctx, "products", { from: today, to: today });
    const mine = prod.rows.find((r) => r.product === `Frame ${run}`);
    expect(mine).toMatchObject({ units: 2, orders: 1, revenue: 150_000, category: `Cat ${run}` });

    const cust = await runReport(ctx, "customers", { from: today, to: today });
    expect(cust.rows.find((r) => r.email === customer.email)).toMatchObject({ orders: 1, type: "Account" });

    const inv = await runReport(ctx, "inventory", { from: today, to: today });
    expect(inv.rows.find((r) => r.sku === sku)).toMatchObject({ onHand: 10, reserved: 2, available: 8, state: "OK" });
  });

  it("module permissions narrow the reports a role can open", async () => {
    const inv = await ctxOf(invManager);
    expect(listReports(inv.actor).map((r) => r.key)).toEqual(["inventory"]);
    await expect(runReport(inv, "sales", {})).rejects.toBeInstanceOf(AuthorizationError);
    await runReport(inv, "inventory", {});

    const fin = await ctxOf(finance);
    expect(listReports(fin.actor).map((r) => r.key)).toEqual(expect.arrayContaining(["sales", "revenue", "payments", "refunds"]));
    expect(listReports(fin.actor).map((r) => r.key)).not.toContain("inventory");
  });

  it("exports need reports.export", async () => {
    const mgr = await ctxOf(manager);
    await runReport(mgr, "sales", {});
    await expect(runReport(mgr, "sales", { export: true })).rejects.toBeInstanceOf(AuthorizationError);
    await runReport(await ctxOf(finance), "sales", { export: true });
  });

  it("validates date ranges", () => {
    expect(resolveRange({ from: "2026-01-01", to: "2026-01-31" })).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(() => resolveRange({ from: "2026-02-01", to: "2026-01-01" })).toThrow(ValidationError);
    expect(() => resolveRange({ from: "2024-01-01", to: "2026-01-01" })).toThrow(ValidationError);
    const d = resolveRange({ from: "2026-02-31", to: "nonsense" });
    expect(d.to).toBe(today);
  });
});

describe("exports", () => {
  const sample: ReportResult = {
    key: "refunds",
    title: "Refunds",
    description: "",
    range: { from: "2026-01-01", to: "2026-01-31" },
    columns: [
      { key: "order", label: "Order", kind: "text" },
      { key: "reason", label: "Reason", kind: "text" },
      { key: "amount", label: "Amount", kind: "money" },
    ],
    rows: [
      { order: "ORD-1", reason: '=HYPERLINK("x")', amount: 12_345 },
      { order: "ORD-2", reason: "Broken, glass", amount: 100 },
    ],
    totals: { order: "Total", reason: null, amount: 12_445 },
    truncated: false,
  };

  it("CSV has a BOM, rupee amounts, quoting and formula neutralising", () => {
    const csv = reportToCsv(sample);
    expect(csv.startsWith("﻿Order,Reason,Amount (₹)\r\n")).toBe(true);
    expect(csv).toContain(`ORD-1,"'=HYPERLINK(""x"")",123.45`);
    expect(csv).toContain(`ORD-2,"Broken, glass",1`);
    expect(csv).toContain("Total,,124.45");
  });

  it("XLSX is a valid zip with a worksheet", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const bytes = reportToXlsx(sample);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("<v>123.45</v>");
    expect(text).toContain("=HYPERLINK(&quot;x&quot;)");
  });
});
