import { type ClerkIdentity, syncIdentity, unlinkClerkUser } from "@ecom/auth";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type UserJSON = {
  id: string;
  primary_email_address_id: string | null;
  email_addresses: { id: string; email_address: string; verification: { status: string } | null }[];
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  has_image: boolean;
};

function identityFrom(u: UserJSON): ClerkIdentity {
  const primary = u.email_addresses.find((e) => e.id === u.primary_email_address_id);
  return {
    clerkUserId: u.id,
    email: primary?.email_address ?? null,
    emailVerified: primary?.verification?.status === "verified",
    name: [u.first_name, u.last_name].filter(Boolean).join(" ") || null,
    image: u.has_image ? u.image_url : null,
  };
}

/**
 * Optional Clerk webhook (Svix-signed; needs CLERK_WEBHOOK_SIGNING_SECRET).
 * Sign-in works without it: users are linked on first request. It keeps
 * name/email/photo in step when changed in Clerk, and unlinks deleted Clerk
 * users. It never grants roles or changes account status.
 */
export async function POST(req: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) return new Response("Webhook not configured", { status: 503 });
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.updated") {
    await syncIdentity(identityFrom(evt.data as unknown as UserJSON));
  } else if (evt.type === "user.deleted" && evt.data.id) {
    await unlinkClerkUser(evt.data.id);
  }
  return new Response("ok", { status: 200 });
}
