import { getProductBySlug } from "@ecom/services";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Public product detail (used by Quick View; reusable by a future mobile app). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const rl = rateLimit(`product:${clientIp(req)}`, 120, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return Response.json({ error: "Not found." }, { status: 404 });
  const product = await getProductBySlug(slug);
  if (!product) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(product, { headers: { "Cache-Control": "public, max-age=60" } });
}
