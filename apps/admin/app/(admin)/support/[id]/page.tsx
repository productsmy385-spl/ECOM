import { PageHeader } from "@/components/layout/page-header";
import { requireStaff } from "@/lib/session";
import { can } from "@ecom/rbac";
import { getTicketAdmin, listSupportAgents, NotFoundError } from "@ecom/services";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketPanel } from "./ticket-panel";

export const metadata: Metadata = { title: "Support ticket" };
export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { actor } = await requireStaff("support.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let t;
  try {
    t = await getTicketAdmin({ actor }, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const agents = await listSupportAgents({ actor });
  return (
    <div className="space-y-6">
      <Link href="/support" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Support
      </Link>
      <PageHeader title={t.subject} description={`${t.ticketNumber} · ${t.customer.name}${t.customer.email ? ` (${t.customer.email})` : ""}`} />
      <TicketPanel ticket={JSON.parse(JSON.stringify(t))} agents={agents} canManage={can(actor, "support.manage")} />
    </div>
  );
}
