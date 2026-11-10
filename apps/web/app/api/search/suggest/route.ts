import { suggest } from "@ecom/services";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = rateLimit(`suggest:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json(await suggest(q), { headers: { "Cache-Control": "public, max-age=30" } });
}
