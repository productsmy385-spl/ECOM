/**
 * Order pricing: one pure function shared by the cart page, checkout and the
 * order service, so what the customer sees is exactly what is charged. Money
 * is integer paise. Prices are GST-inclusive, so tax is extracted from each
 * line (after its share of any discount); it is never added on top.
 */

export type ShippingMethod = "standard" | "express";
export type CouponKind = "percent" | "fixed" | "free_shipping";

export interface PriceLine {
  key: string;
  /** Unit price incl. customisation, paise. */
  unitPrice: number;
  quantity: number;
  /** GST rate in basis points (1800 = 18%). */
  taxRateBps: number;
}

export interface CouponRule {
  code: string;
  type: CouponKind;
  /** percent: basis points (1000 = 10%); fixed: paise; free_shipping: ignored. */
  value: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
}

export interface ShippingRules {
  freeThreshold: number;
  standardFee: number;
  expressFee: number;
}

export interface PricedLine {
  key: string;
  lineTotal: number;
  discount: number;
  taxAmount: number;
}

export interface PriceResult {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  /** GST contained in the total (informational; already included). */
  taxAmount: number;
  total: number;
  coupon: { code: string; applied: boolean; freeShipping: boolean; reason?: string } | null;
  /** How much more (after discount) unlocks free standard shipping; 0 when already free. */
  freeShippingRemaining: number;
}

const inclusiveTax = (amount: number, rateBps: number) => (rateBps > 0 ? Math.round((amount * rateBps) / (10_000 + rateBps)) : 0);

/** Splits `total` across `weights` proportionally; remainders go to the largest weights first. Sums exactly. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => Math.floor((total * w) / sum));
  let rest = total - raw.reduce((a, b) => a + b, 0);
  const order = weights.map((w, i) => [w, i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) raw[order[k]![1]]! += 1;
  return raw;
}

export function priceOrder(input: {
  lines: PriceLine[];
  coupon?: CouponRule | null;
  shipping: ShippingRules;
  method: ShippingMethod;
}): PriceResult {
  const lineTotals = input.lines.map((l) => l.unitPrice * l.quantity);
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);

  let discount = 0;
  let freeShipping = false;
  let coupon: PriceResult["coupon"] = null;
  if (input.coupon) {
    const c = input.coupon;
    if (subtotal < c.minOrderAmount) {
      const short = (c.minOrderAmount - subtotal) / 100;
      coupon = {
        code: c.code,
        applied: false,
        freeShipping: false,
        reason: `Add ₹${short.toLocaleString("en-IN", { maximumFractionDigits: 2 })} more to use this code.`,
      };
    } else {
      if (c.type === "percent") discount = Math.floor((subtotal * c.value) / 10_000);
      else if (c.type === "fixed") discount = c.value;
      else freeShipping = true;
      if (c.maxDiscountAmount !== null && c.type !== "free_shipping") discount = Math.min(discount, c.maxDiscountAmount);
      discount = Math.max(0, Math.min(discount, subtotal));
      coupon = { code: c.code, applied: true, freeShipping };
    }
  }

  const shares = allocate(discount, lineTotals);
  const lines = input.lines.map((l, i) => {
    const net = lineTotals[i]! - shares[i]!;
    return { key: l.key, lineTotal: lineTotals[i]!, discount: shares[i]!, taxAmount: inclusiveTax(net, l.taxRateBps) };
  });

  const afterDiscount = subtotal - discount;
  const standardFree = afterDiscount >= input.shipping.freeThreshold;
  let shipping = 0;
  if (subtotal > 0 && !freeShipping) {
    shipping = input.method === "express" ? input.shipping.expressFee : standardFree ? 0 : input.shipping.standardFee;
  }

  return {
    lines,
    subtotal,
    discount,
    shipping,
    taxAmount: lines.reduce((a, l) => a + l.taxAmount, 0),
    total: afterDiscount + shipping,
    coupon,
    freeShippingRemaining: standardFree || freeShipping ? 0 : input.shipping.freeThreshold - afterDiscount,
  };
}
