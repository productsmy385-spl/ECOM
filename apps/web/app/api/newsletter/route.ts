import { subscribeNewsletter } from "@ecom/services";
import { ZodError } from "zod";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Same-origin only (CSRF / abuse from other sites).
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(process.env.WEB_URL ?? "http://localhost:3000").origin) {
    return Response.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }
  const rl = rateLimit(`newsletter:${clientIp(req)}`, 5, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try {
    await subscribeNewsletter(await req.json());
    // Same response whether the address was new or already subscribed.
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError || err instanceof SyntaxError) {
      return Response.json({ error: "Enter a valid email address." }, { status: 422 });
    }
    console.error("[newsletter]", err);
    return Response.json({ error: "Couldn't subscribe right now." }, { status: 500 });
  }
}
