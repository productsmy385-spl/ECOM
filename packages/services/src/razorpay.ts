/**
 * Razorpay over its REST API (no SDK). Every money-moving decision is made
 * server-side: signatures are verified with HMAC-SHA256 and a timing-safe
 * compare, and payments are re-fetched from Razorpay before an order is
 * marked paid. Checkout code depends on the PaymentGateway interface so tests
 * can substitute a fake.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface GatewayPayment {
  id: string;
  orderId: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string | null;
  errorDescription: string | null;
}

export interface PaymentGateway {
  keyId: string;
  createOrder(input: { amount: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string; amount: number }>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  capturePayment(paymentId: string, amount: number): Promise<GatewayPayment>;
  listOrderPayments(razorpayOrderId: string): Promise<GatewayPayment[]>;
  /** Refunds `amount` paise of a captured payment; returns Razorpay's refund id and status. */
  refundPayment(paymentId: string, amount: number, notes: Record<string, string>): Promise<{ id: string; status: string }>;
  verifyPaymentSignature(razorpayOrderId: string, paymentId: string, signature: string): boolean;
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Webhook check: HMAC-SHA256 of the RAW request body with the webhook secret. */
export function verifyRazorpayWebhook(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  return safeEqualHex(hmacHex(secret, rawBody), signature);
}

function mapPayment(p: Record<string, unknown>): GatewayPayment {
  return {
    id: String(p.id),
    orderId: (p.order_id as string | null) ?? null,
    amount: Number(p.amount),
    currency: String(p.currency ?? "INR"),
    status: p.status as GatewayPayment["status"],
    method: (p.method as string | null) ?? null,
    errorDescription: (p.error_description as string | null) ?? null,
  };
}

export class RazorpayError extends Error {
  readonly status = 502;
  constructor(message: string) {
    super(message);
    this.name = "RazorpayError";
  }
}

/** The live gateway, or null when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET aren't set. */
export function razorpayGateway(): PaymentGateway | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return null;
  const auth = `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;

  async function call(path: string, init: { method?: string; body?: unknown } = {}) {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const desc = (json.error as { description?: string } | undefined)?.description ?? `HTTP ${res.status}`;
      throw new RazorpayError(`Razorpay: ${desc}`);
    }
    return json;
  }

  return {
    keyId,
    async createOrder({ amount, receipt, notes }) {
      const o = await call("/orders", { method: "POST", body: { amount, currency: "INR", receipt, notes } });
      return { id: String(o.id), amount: Number(o.amount) };
    },
    async fetchPayment(paymentId) {
      return mapPayment(await call(`/payments/${encodeURIComponent(paymentId)}`));
    },
    async capturePayment(paymentId, amount) {
      return mapPayment(await call(`/payments/${encodeURIComponent(paymentId)}/capture`, { method: "POST", body: { amount, currency: "INR" } }));
    },
    async listOrderPayments(razorpayOrderId) {
      const r = await call(`/orders/${encodeURIComponent(razorpayOrderId)}/payments`);
      return ((r.items as Record<string, unknown>[]) ?? []).map(mapPayment);
    },
    async refundPayment(paymentId, amount, notes) {
      const r = await call(`/payments/${encodeURIComponent(paymentId)}/refund`, { method: "POST", body: { amount, notes, speed: "normal" } });
      return { id: String(r.id), status: String(r.status) };
    },
    verifyPaymentSignature(razorpayOrderId, paymentId, signature) {
      return safeEqualHex(hmacHex(secret, `${razorpayOrderId}|${paymentId}`), signature);
    },
  };
}
