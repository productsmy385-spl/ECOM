"use client";

import type { PaymentStart } from "@ecom/services";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void };

let loading: Promise<RazorpayCtor> | null = null;

function loadCheckout(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Payment window failed to load.")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout, then has OUR server verify the signature and the
 * payment before anything is shown as paid. Resolves "paid", "dismissed" or
 * throws with a customer-facing message.
 */
export async function payWithRazorpay(
  payment: PaymentStart,
  verify: { orderId: string; orderToken?: string },
  brand: string,
): Promise<"paid" | "dismissed"> {
  const Razorpay = await loadCheckout();
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      order_id: payment.razorpayOrderId,
      name: brand,
      description: `Order ${payment.orderNumber}`,
      prefill: payment.prefill,
      theme: { color: "#CF0F47" },
      modal: { ondismiss: () => resolve("dismissed"), confirm_close: true },
      handler: async (r: RazorpayResponse) => {
        const res = await fetch(`/api/orders/${verify.orderId}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayOrderId: r.razorpay_order_id,
            razorpayPaymentId: r.razorpay_payment_id,
            razorpaySignature: r.razorpay_signature,
            ...(verify.orderToken ? { orderToken: verify.orderToken } : {}),
          }),
        }).catch(() => null);
        if (res?.ok) resolve("paid");
        else {
          const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
          reject(new Error(body?.error ?? "We couldn't confirm the payment yet. If money was taken, your order updates automatically within a few minutes."));
        }
      },
    });
    rzp.on("payment.failed", () => {
      /* Razorpay shows the failure and lets the customer retry inside the window. */
    });
    rzp.open();
  });
}
