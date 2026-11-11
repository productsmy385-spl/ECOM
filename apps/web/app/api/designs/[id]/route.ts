import { deleteDesign, getDesign, updateDesign } from "@ecom/services";
import { designRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";

export const GET = designRoute<{ id: string }>(({ owner, params }) => getDesign(owner, params.id));
export const PUT = designRoute<{ id: string }>(async ({ req, owner, params }) => updateDesign(owner, params.id, await req.json()), { limit: 60 });
export const DELETE = designRoute<{ id: string }>(async ({ owner, params }) => {
  await deleteDesign(owner, params.id);
  return { ok: true };
});
