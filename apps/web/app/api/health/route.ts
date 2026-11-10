import { pingDatabase } from "@ecom/db";

export const dynamic = "force-dynamic";

/** Railway health check. 503 when the database is unreachable. */
export async function GET() {
  const database = await pingDatabase();
  return Response.json(
    { status: database.ok ? "ok" : "degraded", app: "web", database: { ok: database.ok, latencyMs: database.latencyMs } },
    { status: database.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
