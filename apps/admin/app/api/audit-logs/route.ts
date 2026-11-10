import { auditFacets, listAuditLogs } from "@ecom/services";
import { apiRoute, searchParams } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async ({ req, ctx }) => {
  const query = searchParams(req);
  if (query.facets === "1") return auditFacets(ctx);
  return listAuditLogs(ctx, query);
});
