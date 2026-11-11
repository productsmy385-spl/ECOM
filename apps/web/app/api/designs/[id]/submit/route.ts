import { submitDesign } from "@ecom/services";
import { designRoute } from "@/lib/api-route";

export const dynamic = "force-dynamic";

export const POST = designRoute<{ id: string }>(({ owner, params }) => submitDesign(owner, params.id), { limit: 20 });
