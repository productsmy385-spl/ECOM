import { createHmac, randomUUID } from "node:crypto";
import { AuthorizationError } from "@ecom/services";
import { canAny } from "@ecom/rbac";
import { apiRoute } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Short-lived signature for a browser-to-ImageKit upload (the private key never
 * leaves the server). ImageKit signature = HMAC-SHA1(privateKey, token + expire).
 */
export const GET = apiRoute(async ({ ctx }) => {
  // Catalog editors, designers (artwork) and delivery captains (proof photos).
  if (!canAny(ctx.actor, ["products.create", "products.update", "categories.manage", "designs.create", "deliveries.update", "deliveries.update_assigned"])) {
    throw new AuthorizationError();
  }
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!privateKey || !publicKey || !urlEndpoint) {
    return Response.json(
      { error: "Image uploads aren't configured yet. Add the ImageKit keys to the environment.", configured: false },
      { status: 503 },
    );
  }
  const token = randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 30 * 60; // must be < 1 hour
  const signature = createHmac("sha1", privateKey).update(token + expire).digest("hex");
  return { token, expire, signature, publicKey, urlEndpoint, configured: true };
});
