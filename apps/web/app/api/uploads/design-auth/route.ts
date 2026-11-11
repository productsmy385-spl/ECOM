import { createHmac, randomUUID } from "node:crypto";
import { resolveDesignOwner } from "@/lib/design-owner";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Short-lived ImageKit upload signature for customer design images.
 * Tighter than staff uploads: rate limited, owner cookie required (created
 * here if needed), and uploads land in /customer-designs.
 */
export async function GET(req: Request) {
  const rl = rateLimit(`design-upload:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!privateKey || !publicKey || !urlEndpoint) {
    return Response.json({ error: "Image uploads aren't available yet.", configured: false }, { status: 503 });
  }
  await resolveDesignOwner({ create: true });
  const token = randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 10 * 60;
  const signature = createHmac("sha1", privateKey).update(token + expire).digest("hex");
  return Response.json(
    { token, expire, signature, publicKey, urlEndpoint, folder: "/customer-designs", configured: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
