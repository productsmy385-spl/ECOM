import { createDesign, listMyDesigns } from "@ecom/services";
import { designRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";

/** My designs (signed-in customer, or this browser's guest designs). */
export const GET = designRoute(({ owner }) => listMyDesigns(owner));

/** Save a new design (creates the guest cookie on first save). */
export const POST = designRoute(async ({ req, owner }) => createDesign(owner, await req.json()), {
  createOwner: true,
  limit: 20,
  status: 201,
});
