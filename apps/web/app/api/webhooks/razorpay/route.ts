import { handleRazorpayWebhook } from "@ecom/services";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook (payment.captured, order.paid, payment.failed). The HMAC is
 * computed over the RAW body, so it is read as text before any parsing.
 * Returns 5xx on processing errors so Razorpay retries; duplicates are ignored.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 1_000_000) return new Response("Too large", { status: 413 });
  try {
    const r = await handleRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"), req.headers.get("x-razorpay-event-id"));
    return new Response(r.body, { status: r.status });
  } catch (err) {
    console.error("[razorpay webhook]", err);
    return new Response("Processing failed", { status: 500 });
  }
}