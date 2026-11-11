import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/session";
import { cn } from "@/lib/utils";
import { listTicketsAdmin, TICKET_STATUS_LABEL } from "@ecom/services";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

const TABS = [
  { href: "/support", label: "Open", match: (s: string | undefined, m: string | undefined) => !s && !m },
  { href: "/support?mine=1", label: "Assigned to me", match: (_s: string | undefined, m: string | undefined) => m === "1" },
  { href: "/support?status=awaiting_customer", label: "Waiting on customer", match: (s: string | undefined) => s === "awaiting_customer" },
  { href: "/support?status=closed", label: "Resolved", match: (s: string | undefined) => s === "closed" },
];

const PRIORITY_VARIANT = { urgent: "danger", high: "warning", medium: "secondary", low: "secondary" } as const;

export default async function SupportInbox({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string; page?: string }> }) {
  const { actor } = await requireStaff("support.view");
  const sp = await searchParams;
  const data = await listTicketsAdmin({ actor }, sp);
  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Customer requests from the Help centre. Urgent and high priority first." />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", t.match(sp.status, sp.mine) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
            {t.label}
          </Link>
        ))}
      </div>
      <Card className="overflow-hidden p-0">
        {data.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No tickets here.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.items.map((t) => (
              <li key={t.id}>
                <Link href={`/support/${t.id}`} className="flex flex-col gap-2 px-5 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.subject}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.ticketNumber} · {t.customer} · {t.messages} message{t.messages === 1 ? "" : "s"} · {t.assignee ?? "Unassigned"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={PRIORITY_VARIANT[t.priority]}>{t.priority}</Badge>
                    <Badge variant="secondary">{TICKET_STATUS_LABEL[t.status]}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(t.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
