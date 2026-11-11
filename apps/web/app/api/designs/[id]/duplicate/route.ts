import { duplicateDesign } from "@ecom/services";
import { designRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";

export const POST = designRoute<{ id: string }>(({ owner, params }) => duplicateDesign(owner, params.id), { limit: 20, status: 201 });
