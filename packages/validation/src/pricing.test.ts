import { describe, expect, it } from "vitest";
import { allocate, type CouponRule, priceOrder, type ShippingRules } from "./pricing";

const ship: ShippingRules = { freeThreshold: 99_900, standardFee: 4_900, expressFee: 14_900 };
const coupon = (over: Partial<CouponRule>): CouponRule => ({
  code: "TEST",
  type: "percent",
  value: 1000,
  minOrderAmount: 0,
  maxDiscountAmount: null,
  ...over,
});

describe("allocate", () => {
  it("splits proportionally and always sums exactly", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1, [500, 300])).toEqual([1, 0]);
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
    const parts = allocate(9_999, [12_345, 678, 90_001]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(9_999);
  });
});

describe("priceOrder", () => {
  it("charges standard shipping below the threshold and extracts inclusive GST", () => {
    const r = priceOrder({ lines: [{ key: "a", unitPrice: 59_000, quantity: 1, taxRateBps: 1800 }], shipping: ship, method: "standard" });
    expect(r.subtotal).toBe(59_000);
    expect(r.shipping).toBe(4_900);
    expect(r.total).toBe(63_900);
    // 590.00 incl. 18% GST → 90.00 tax
    expect(r.taxAmount).toBe(9_000);
    expect(r.freeShippingRemaining).toBe(40_900);
  });

  it("makes standard shipping free at the threshold (after discount), but not express", () => {
    const lines = [{ key: "a", unitPrice: 50_000, quantity: 2, taxRateBps: 1200 }];
    expect(priceOrder({ lines, shipping: ship, method: "standard" }).shipping).toBe(0);
    expect(priceOrder({ lines, shipping: ship, method: "express" }).shipping).toBe(14_900);
    // A 10% discount takes 1000.00 below 999.00 → shipping applies again.
    const d = priceOrder({ lines, coupon: coupon({}), shipping: ship, method: "standard" });
    expect(d.discount).toBe(10_000);
    expect(d.shipping).toBe(4_900);
    expect(d.total).toBe(100_000 - 10_000 + 4_900);
  });

  it("caps percent discounts and never discounts below zero", () => {
    const lines = [{ key: "a", unitPrice: 100_000, quantity: 1, taxRateBps: 0 }];
    expect(priceOrder({ lines, coupon: coupon({ value: 5000, maxDiscountAmount: 20_000 }), shipping: ship, method: "standard" }).discount).toBe(20_000);
    const fixed = priceOrder({ lines, coupon: coupon({ type: "fixed", value: 500_000 }), shipping: ship, method: "standard" });
    expect(fixed.discount).toBe(100_000);
    expect(fixed.total).toBe(4_900); // nothing left to discount; shipping still due
  });

  it("refuses a coupon below its minimum order and says how much more is needed", () => {
    const r = priceOrder({
      lines: [{ key: "a", unitPrice: 40_000, quantity: 1, taxRateBps: 0 }],
      coupon: coupon({ minOrderAmount: 50_000 }),
      shipping: ship,
      method: "standard",
    });
    expect(r.coupon).toMatchObject({ applied: false });
    expect(r.coupon?.reason).toContain("₹100");
    expect(r.discount).toBe(0);
  });

  it("free-shipping coupons zero shipping for either method", () => {
    const lines = [{ key: "a", unitPrice: 10_000, quantity: 1, taxRateBps: 0 }];
    const c = coupon({ type: "free_shipping", value: 0 });
    expect(priceOrder({ lines, coupon: c, shipping: ship, method: "express" }).shipping).toBe(0);
    expect(priceOrder({ lines, coupon: c, shipping: ship, method: "standard" }).freeShippingRemaining).toBe(0);
  });

  it("spreads the discount across lines so per-line tax stays consistent", () => {
    const r = priceOrder({
      lines: [
        { key: "lip", unitPrice: 30_000, quantity: 1, taxRateBps: 1800 },
        { key: "frame", unitPrice: 70_000, quantity: 1, taxRateBps: 1200 },
      ],
      coupon: coupon({ type: "fixed", value: 10_000 }),
      shipping: ship,
      method: "standard",
    });
    expect(r.lines.map((l) => l.discount)).toEqual([3_000, 7_000]);
    expect(r.lines[0]!.taxAmount).toBe(Math.round((27_000 * 1800) / 11_800));
    expect(r.lines[1]!.taxAmount).toBe(Math.round((63_000 * 1200) / 11_200));
  });

  it("an empty cart costs nothing", () => {
    expect(priceOrder({ lines: [], shipping: ship, method: "express" })).toMatchObject({ subtotal: 0, shipping: 0, total: 0 });
  });
});
