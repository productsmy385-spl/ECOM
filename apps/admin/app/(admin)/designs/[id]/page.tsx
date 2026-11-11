import { EmptyState } from "@/components/ui/empty-state";
import { requireStaffAny } from "@/lib/session";
import { type Actor, can, canAny } from "@ecom/rbac";
import { getDesignAdmin, NotFoundError } from "@ecom/services";
import { Palette } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignReview } from "./design-review";

export const metadata: Metadata = { title: "Design" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(actor: Actor, id: string) {
  try {
    // Same assignment-scoped service as the API: a designer gets 404 for others' designs.
    return await getDesignAdmin({ actor }, id);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { actor } = await requireStaffAny(["designs.view", "designs.view_assigned"]);
  const design = await load(actor, id);
  if (!design) {
    return <EmptyState icon={<Palette className="h-8 w-8" />} title="Design not found" description="It may not be assigned to you, or it no longer exists." />;
  }
  return (
    <DesignReview
      initial={JSON.parse(JSON.stringify(design))}
      can={{
        assign: can(actor, "designs.assign"),
        approve: can(actor, "designs.approve"),
        note: canAny(actor, ["designs.update", "designs.approve"]),
      }}
    />
  );
}
